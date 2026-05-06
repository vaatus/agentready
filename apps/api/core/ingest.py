"""Repo ingest layer — clone, detect framework, extract agent surface area.

Returns an AgentManifest describing the target agent's tools, system prompt,
and memory configuration. The orchestrator and each evaluation agent consume
this manifest.
"""

from __future__ import annotations

import asyncio
import hashlib
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from pathlib import Path

from apps.api.core.config import get_settings


@dataclass
class AgentManifest:
    """Everything we know about a target agent after ingest."""

    slug: str
    github_url: str
    repo_sha: str
    clone_path: Path
    framework: str  # langchain | langgraph | crewai | autogen | custom | unknown
    entry_points: list[Path] = field(default_factory=list)
    system_prompt: str | None = None
    declared_tools: list[str] = field(default_factory=list)
    has_memory: bool = False
    memory_kind: str | None = None  # vector | conversation | persistent_kv | none
    detected_models: list[str] = field(default_factory=list)
    notes: list[str] = field(default_factory=list)


_FRAMEWORK_MARKERS: dict[str, list[str]] = {
    "langgraph": ["langgraph", "from langgraph"],
    "crewai": ["crewai", "from crewai"],
    "autogen": ["autogen", "pyautogen", "from autogen"],
    "langchain": ["langchain", "from langchain"],
}

_MEMORY_MARKERS: dict[str, list[str]] = {
    "vector": ["chromadb", "pinecone", "weaviate", "qdrant", "from chroma", "from pinecone"],
    "conversation": ["ConversationBufferMemory", "ConversationSummaryMemory", "ChatMessageHistory"],
    "persistent_kv": ["redis", "from redis", "json.dump", "shelve.open"],
}

_TOOL_NAME_RE = re.compile(r"@tool\s*(?:\([^)]*\))?\s*\ndef\s+(\w+)")
_TOOL_INSTANCE_RE = re.compile(r"Tool\(\s*name\s*=\s*['\"](\w+)['\"]")
_SYSTEM_PROMPT_RE = re.compile(
    r"(?:system|SYSTEM_PROMPT|system_prompt)\s*=\s*[\"']{1,3}([^\"']+)[\"']{1,3}",
    re.MULTILINE,
)


async def _git_clone(github_url: str, dest: Path) -> str:
    """Shallow clone, return the HEAD sha."""
    proc = await asyncio.create_subprocess_exec(
        "git",
        "clone",
        "--depth",
        "1",
        github_url,
        str(dest),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0:
        raise RuntimeError(f"git clone failed: {stderr.decode()}")

    sha_proc = await asyncio.create_subprocess_exec(
        "git",
        "-C",
        str(dest),
        "rev-parse",
        "HEAD",
        stdout=asyncio.subprocess.PIPE,
    )
    sha_out, _ = await sha_proc.communicate()
    return sha_out.decode().strip()


def _detect_framework(haystack: str) -> str:
    for fw, markers in _FRAMEWORK_MARKERS.items():
        if any(m in haystack for m in markers):
            return fw
    return "unknown"


def _detect_memory(haystack: str) -> tuple[bool, str | None]:
    for kind, markers in _MEMORY_MARKERS.items():
        if any(m in haystack for m in markers):
            return True, kind
    return False, None


def _extract_tools(haystack: str) -> list[str]:
    return list({*_TOOL_NAME_RE.findall(haystack), *_TOOL_INSTANCE_RE.findall(haystack)})


def _extract_system_prompt(haystack: str) -> str | None:
    match = _SYSTEM_PROMPT_RE.search(haystack)
    return match.group(1).strip() if match else None


def _read_python_files(root: Path, max_files: int = 200, max_bytes: int = 200_000) -> str:
    """Concatenate up to N Python files. Bounded to keep regex/scan time reasonable."""
    chunks: list[str] = []
    total = 0
    for path in root.rglob("*.py"):
        # Skip vendored deps.
        if any(part in {".git", "venv", ".venv", "node_modules", "__pycache__"} for part in path.parts):
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        chunks.append(text)
        total += len(text)
        if total > max_bytes or len(chunks) > max_files:
            break
    return "\n".join(chunks)


async def ingest(github_url: str, slug: str | None = None) -> AgentManifest:
    """Clone the repo and produce an AgentManifest. Caller owns the clone path on disk."""
    settings = get_settings()
    if slug is None:
        slug = github_url.rstrip("/").split("/")[-1].replace(".git", "").lower()

    cache_root = settings.cache_dir / "clones"
    cache_root.mkdir(parents=True, exist_ok=True)
    clone_path = Path(tempfile.mkdtemp(prefix=f"agentready-{slug}-", dir=cache_root))
    # Clean any partial clone leftover.
    if clone_path.exists() and any(clone_path.iterdir()):
        shutil.rmtree(clone_path)
        clone_path.mkdir()

    sha = await _git_clone(github_url, clone_path)
    haystack = _read_python_files(clone_path)

    framework = _detect_framework(haystack)
    has_memory, memory_kind = _detect_memory(haystack)
    tools = _extract_tools(haystack)
    system_prompt = _extract_system_prompt(haystack)

    notes: list[str] = []
    if framework == "unknown":
        notes.append("Framework not auto-detected; falling back to generic Python entrypoint scan.")
    if not tools:
        notes.append("No tools extracted via @tool / Tool(name=) markers.")
    if not system_prompt:
        notes.append("No system prompt extracted; ASI09 social-engineering tests will be untargeted.")

    manifest = AgentManifest(
        slug=slug,
        github_url=github_url,
        repo_sha=sha,
        clone_path=clone_path,
        framework=framework,
        system_prompt=system_prompt,
        declared_tools=tools,
        has_memory=has_memory,
        memory_kind=memory_kind,
        notes=notes,
    )
    return manifest


def manifest_fingerprint(manifest: AgentManifest) -> str:
    """Stable cache key for a (repo, profile) tuple."""
    settings = get_settings()
    raw = f"{manifest.repo_sha}::{settings.scan_profile}::{manifest.framework}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]
