"""POST /agent/{slug}/remediate, GET /agent/{slug}/remediation/latest.

Triggers a remediation bundle generation against the agent's most recent scan,
or returns the latest cached bundle. Bundle artifacts are also served as
static files at /artifacts/remediations/{slug}/{scan_id}/...
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from agents.remediation_agent import remediate as run_remediate
from apps.api.core.config import get_settings
from apps.api.core.ingest import AgentManifest, ingest
from apps.api.db.models import Agent as AgentRow
from apps.api.db.models import AsiScore, ScanRun, Z3Result
from apps.api.db.session import get_session
from owasp_asi.asi06_memory_poisoning import AttackResult

logger = logging.getLogger(__name__)
router = APIRouter()


@dataclass
class _CachedZ3Report:
    """Just enough of Z3Report's surface for the remediation agent."""

    contracts: list


def _hydrate_failed_attacks(score_rows: list[AsiScore]) -> list[AttackResult]:
    """Hydrate failed attacks from every live ASI score row.

    The DB stores attacks polymorphically — ASI06 has plant/trigger/baseline_response
    fields, ASI01/02/09 have payload instead. We adapt both into AttackResult so
    the remediation pipeline can build guard rules from any failed attack.
    """
    out: list[AttackResult] = []
    for row in score_rows:
        if not row.failed_attacks or not row.is_real:
            continue
        for f in row.failed_attacks:
            try:
                out.append(AttackResult(**f))
                continue
            except TypeError:
                pass
            # ASI01/02/09 shape — payload instead of plant.
            try:
                out.append(
                    AttackResult(
                        category=f.get("category", row.category),
                        seed_name=f.get("name", "?"),
                        plant=f.get("payload", f.get("plant", ""))[:600],
                        trigger=f.get("trigger", "(see payload)"),
                        baseline_response=f.get("baseline_response", ""),
                        post_attack_response=f.get("post_attack_response", ""),
                        altered=bool(f.get("altered", False)),
                        confidence=float(f.get("confidence", 0.0)),
                        reasoning=str(f.get("reasoning", "")),
                    )
                )
            except (TypeError, KeyError, ValueError):
                continue
    return out


def _hydrate_z3(z3_rows: list[Z3Result]) -> _CachedZ3Report | None:
    if not z3_rows:
        return None

    @dataclass
    class _C:
        name: str
        triggered: bool = True
        status: str = "VERIFIED"
        counterexample: dict | None = None
        smt2_source: str = ""

    contracts = [
        _C(
            name=r.contract_name,
            status=r.status,
            counterexample=r.counterexample,
            smt2_source=r.smt2_source,
        )
        for r in z3_rows
    ]
    return _CachedZ3Report(contracts=contracts)


@router.post("/agent/{slug}/remediate")
async def trigger_remediate(slug: str, session: AsyncSession = Depends(get_session)) -> dict:
    agent = await session.get(AgentRow, slug)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {slug!r} not found")

    latest_run = (
        await session.execute(
            select(ScanRun).where(ScanRun.agent_slug == slug).order_by(ScanRun.started_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if latest_run is None:
        raise HTTPException(status_code=400, detail="No scan run for this agent yet")

    score_rows = (
        await session.execute(
            select(AsiScore).where(AsiScore.scan_run_id == latest_run.id)
        )
    ).scalars().all()
    failed_attacks = _hydrate_failed_attacks(list(score_rows))

    z3_rows = (
        await session.execute(select(Z3Result).where(Z3Result.scan_run_id == latest_run.id))
    ).scalars().all()
    z3_report = _hydrate_z3(list(z3_rows))

    # Re-ingest to get a fresh manifest (system_prompt + tools).
    manifest = await ingest(agent.github_url, slug=slug)

    bundle = await run_remediate(
        manifest=manifest,
        scan_id=latest_run.id,
        pre_score=latest_run.overall_score,
        failed_attacks=failed_attacks,
        z3_report=z3_report,  # type: ignore[arg-type]  - structural duck-typing on .contracts
        z3_status=latest_run.z3_status,
    )

    return {
        **bundle.to_dict(),
        "artifact_url_prefix": f"/artifacts/remediations/{slug}/{latest_run.id}/",
    }


@router.get("/agent/{slug}/remediation/latest")
async def latest_remediation(slug: str, session: AsyncSession = Depends(get_session)) -> dict:
    settings = get_settings()
    agent = await session.get(AgentRow, slug)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {slug!r} not found")

    latest_run = (
        await session.execute(
            select(ScanRun).where(ScanRun.agent_slug == slug).order_by(ScanRun.started_at.desc()).limit(1)
        )
    ).scalar_one_or_none()
    if latest_run is None:
        raise HTTPException(status_code=404, detail="No scan run yet")

    bundle_dir: Path = settings.cache_dir.parent / "remediations" / slug / latest_run.id
    manifest_path = bundle_dir / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="No remediation bundle yet — POST /remediate first")

    return {
        **json.loads(manifest_path.read_text()),
        "artifact_url_prefix": f"/artifacts/remediations/{slug}/{latest_run.id}/",
    }


@router.get("/artifacts/remediations/{slug}/{scan_id}/{path:path}")
async def serve_artifact(slug: str, scan_id: str, path: str) -> FileResponse:
    settings = get_settings()
    base = (settings.cache_dir.parent / "remediations" / slug / scan_id).resolve()
    target = (base / path).resolve()
    # Path-traversal guard.
    if not str(target).startswith(str(base)):
        raise HTTPException(status_code=400, detail="invalid path")
    if not target.exists():
        raise HTTPException(status_code=404, detail=f"{path} not in bundle")
    return FileResponse(target)
