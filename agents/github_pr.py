"""Open a real GitHub PR for a Remediation bundle.

We fork the target repo to the user's namespace, push the bundle files to a
new branch on the fork, and open a draft PR against the fork's default
branch. We never PR against upstream — that would be demo theater spam to
maintainers. The fork is the substrate: the PR exists, the diff is real,
maintainers stay un-bothered.

Idempotent: re-running for the same scan reuses the fork and force-pushes
the branch.

Auth: uses the `gh` CLI when authenticated (preferred — no token mgmt). Falls
back to PyGithub with GITHUB_TOKEN env var.
"""

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
    """Returns a GhContext if either the gh CLI is authed or GITHUB_TOKEN is set.

    In containers we rely on GH_TOKEN env (gh CLI reads it). On dev laptops
    we use the user's existing gh auth.
    """
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

    # Token-based path: GITHUB_TOKEN works for both gh CLI and PyGithub.
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        # gh CLI reads GH_TOKEN automatically; surface the user from the API.
        os.environ.setdefault("GH_TOKEN", token)
        try:
            r = _run(["gh", "api", "user", "-q", ".login"], check=False)
            if r.returncode == 0 and r.stdout.strip():
                return GhContext(user=r.stdout.strip(), via_cli=True)
        except FileNotFoundError:
            pass
    return None


def _parse_owner_repo(github_url: str) -> tuple[str, str]:
    """Accepts https URLs and returns (owner, repo)."""
    u = urllib.parse.urlparse(github_url)
    parts = [p for p in u.path.split("/") if p]
    if len(parts) < 2:
        raise GitHubPRError(f"can't parse owner/repo from {github_url!r}")
    owner, repo = parts[0], parts[1].removesuffix(".git")
    return owner, repo


def _ensure_fork(ctx: GhContext, owner: str, repo: str) -> str:
    """Fork upstream → ctx.user/{repo}. Returns the fork's clone URL.

    HTTPS with token-in-URL when GH_TOKEN is set (container path).
    SSH otherwise (dev laptop with ~/.ssh keys).
    """
    import os

    target = f"{ctx.user}/{repo}"
    # Probe for existing fork. Idempotent.
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
    """Fork → branch → push bundle → open draft PR. Returns the PR URL."""
    ctx = detect_auth()
    if ctx is None:
        raise GitHubPRError("no GitHub auth (run `gh auth login` or set GITHUB_TOKEN)")

    owner, repo = _parse_owner_repo(upstream_url)
    fork_clone_url = _ensure_fork(ctx, owner, repo)
    branch = _branch_name(scan_id)

    work = Path(tempfile.mkdtemp(prefix=f"agentready-pr-{repo}-"))
    try:
        _run(["git", "clone", "--depth", "1", fork_clone_url, str(work)])
        # Determine the fork's default branch (could be `main` or `master`).
        head_branch = _run(
            ["git", "-C", str(work), "rev-parse", "--abbrev-ref", "HEAD"],
        ).stdout.strip() or "main"

        # New branch off head.
        _run(["git", "-C", str(work), "checkout", "-b", branch])

        # Drop bundle files into a top-level `agentready/` directory in the target repo
        # so the PR diff is clearly scoped.
        target_dir = work / "agentready"
        if target_dir.exists():
            shutil.rmtree(target_dir)
        shutil.copytree(bundle_dir, target_dir)

        # Stage + commit. Pull author identity from gh.
        author = _run(["gh", "api", "user", "-q", ".email,.login"]).stdout.splitlines()
        login = author[1].strip() if len(author) > 1 else ctx.user
        email = author[0].strip() or f"{login}@users.noreply.github.com"
        env = None  # use ambient git config; we set author via -c

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
        out = _run(
            [
                "gh", "pr", "create",
                "--repo", f"{ctx.user}/{repo}",
                "--base", head_branch,
                "--head", branch,
                "--title", pr_title,
                "--body-file", str(body_path),
                "--draft",
            ],
            check=False,
        )
        if out.returncode != 0 and "already exists" in (out.stderr or "").lower():
            # Find the existing PR.
            existing = _run(
                ["gh", "pr", "list",
                 "--repo", f"{ctx.user}/{repo}",
                 "--head", branch,
                 "--json", "url",
                 "--jq", ".[0].url"],
            ).stdout.strip()
            if existing:
                return existing
        if out.returncode != 0:
            raise GitHubPRError(f"gh pr create failed: {out.stderr}")
        # gh prints the URL on stdout.
        url = out.stdout.strip().splitlines()[-1]
        return url
    finally:
        shutil.rmtree(work, ignore_errors=True)
