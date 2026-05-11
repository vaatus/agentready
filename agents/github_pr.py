"""Open a draft PR against a fork in our namespace via the gh CLI."""

from __future__ import annotations

import logging
import shutil
import subprocess
import tempfile
import urllib.parse
from dataclasses import dataclass
from pathlib import Path

logger = logging.getLogger(__name__)


@dataclass
class GhContext:
    user: str  # the namespace we fork into (e.g. "vaatus")
    via_cli: bool


class GitHubPRError(RuntimeError):
    pass


def _run(cmd: list[str], *, cwd: Path | None = None, check: bool = True, env: dict | None = None) -> subprocess.CompletedProcess:
    logger.info("[gh] %s", " ".join(cmd))
    return subprocess.run(
        cmd,
        cwd=str(cwd) if cwd else None,
        check=check,
        capture_output=True,
        text=True,
        env=env,
    )


def detect_auth() -> GhContext | None:
    import os

    try:
        r = _run(["gh", "auth", "status"], check=False)
        if r.returncode == 0:
            user = ""
            for line in r.stdout.splitlines() + r.stderr.splitlines():
                if "Logged in to github.com account" in line:
                    user = line.split("account", 1)[1].strip().split()[0]
                    break
            if user:
                return GhContext(user=user, via_cli=True)
    except FileNotFoundError:
        pass

    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        os.environ.setdefault("GH_TOKEN", token)
        try:
            r = _run(["gh", "api", "user", "-q", ".login"], check=False)
            if r.returncode == 0 and r.stdout.strip():
                return GhContext(user=r.stdout.strip(), via_cli=True)
        except FileNotFoundError:
            pass
    return None


def _parse_owner_repo(github_url: str) -> tuple[str, str]:
    u = urllib.parse.urlparse(github_url)
    parts = [p for p in u.path.split("/") if p]
    if len(parts) < 2:
        raise GitHubPRError(f"can't parse owner/repo from {github_url!r}")
    owner, repo = parts[0], parts[1].removesuffix(".git")
    return owner, repo


def _ensure_fork(ctx: GhContext, owner: str, repo: str) -> str:
    """Fork upstream → ctx.user/{repo}. HTTPS+token in container, SSH on dev."""
    import os

    target = f"{ctx.user}/{repo}"
    r = _run(["gh", "repo", "view", target, "--json", "name"], check=False)
    if r.returncode != 0:
        _run(["gh", "repo", "fork", f"{owner}/{repo}", "--clone=false"])
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        return f"https://x-access-token:{token}@github.com/{target}.git"
    return f"git@github.com:{target}.git"


def _branch_name(scan_id: str) -> str:
    return f"agentready/asi2026-fix-{scan_id[:8]}"


def open_pr(
    *,
    upstream_url: str,
    bundle_dir: Path,
    scan_id: str,
    pr_title: str,
    pr_body: str,
) -> str:
    ctx = detect_auth()
    if ctx is None:
        raise GitHubPRError("no GitHub auth (run `gh auth login` or set GITHUB_TOKEN)")

    owner, repo = _parse_owner_repo(upstream_url)
    fork_clone_url = _ensure_fork(ctx, owner, repo)
    branch = _branch_name(scan_id)

    work = Path(tempfile.mkdtemp(prefix=f"agentready-pr-{repo}-"))
    try:
        _run(["git", "clone", "--depth", "1", fork_clone_url, str(work)])
        head_branch = _run(
            ["git", "-C", str(work), "rev-parse", "--abbrev-ref", "HEAD"],
        ).stdout.strip() or "main"

        _run(["git", "-C", str(work), "checkout", "-b", branch])

        # Bundle lands under top-level agentready/ for a scoped PR diff.
        target_dir = work / "agentready"
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(bundle_dir, target_dir)

        author = _run(["gh", "api", "user", "-q", ".email,.login"]).stdout.splitlines()
        login = author[1].strip() if len(author) > 1 else ctx.user
        email = author[0].strip() or f"{login}@users.noreply.github.com"
        env = None

        _run(["git", "-C", str(work), "add", "agentready"])
        _run(
            [
                "git",
                "-c", f"user.name=AgentReady ({login})",
                "-c", f"user.email={email}",
                "-C", str(work),
                "commit",
                "-m", pr_title,
            ],
            env=env,
        )
        _run(["git", "-C", str(work), "push", "-u", "origin", branch, "-f"])

        # Open draft PR against the fork's default branch.
        body_path = work / ".pr_body.md"
        body_path.write_text(pr_body)
        # Open as a real (non-draft) PR — drafts hide from notifications and look
        # less "real" in the demo. The fork is in our namespace so opening a
        # non-draft PR doesn't notify the upstream maintainer.
        out = _run(
            [
                "gh", "pr", "create",
                "--repo", f"{ctx.user}/{repo}",
                "--base", head_branch,
                "--head", branch,
                "--title", pr_title,
                "--body-file", str(body_path),
            ],
            check=False,
        )
        # On ANY failure (already-exists, 504, network blip…) try to find an
        # existing open PR for this branch. We pushed the branch successfully,
        # so a prior run may have already opened the PR.
        if out.returncode != 0:
            existing = _run(
                ["gh", "pr", "list",
                 "--repo", f"{ctx.user}/{repo}",
                 "--head", branch,
                 "--state", "all",
                 "--json", "url",
                 "--jq", ".[0].url"],
                check=False,
            ).stdout.strip()
            if existing:
                logger.info("found existing PR for branch %s: %s", branch, existing)
                return existing
            raise GitHubPRError(f"gh pr create failed: {out.stderr}")
        url = out.stdout.strip().splitlines()[-1]
        return url
    finally:
        shutil.rmtree(work, ignore_errors=True)
