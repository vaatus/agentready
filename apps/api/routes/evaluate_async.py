"""User-submitted scan with progress tracking.

POST /evaluate-async  → kicks off scan in background, returns {scan_id} immediately.
GET  /scan/{id}/status → current step + result snippet when complete.

Persistence to DB still happens at end of scan via the same path as /evaluate.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.orchestrator import SCAN_PROGRESS, run_scan
from apps.api.db.models import Agent, AsiScore, ChaosRun, ScanRun, Z3Result
from apps.api.db.session import SessionLocal, get_session

logger = logging.getLogger(__name__)
router = APIRouter()


class EvaluateAsyncRequest(BaseModel):
    github_url: HttpUrl
    slug: str | None = None


class EvaluateAsyncResponse(BaseModel):
    scan_id: str
    status: str


@router.post("/evaluate-async", response_model=EvaluateAsyncResponse)
async def evaluate_async(req: EvaluateAsyncRequest) -> EvaluateAsyncResponse:
    if req.github_url.host not in {"github.com", "www.github.com"}:
        raise HTTPException(status_code=400, detail="github_url must be a github.com URL")

    scan_id = uuid.uuid4().hex
    SCAN_PROGRESS[scan_id] = {"step": "queued", "updated_at": datetime.now(timezone.utc).isoformat()}

    asyncio.create_task(_run_and_persist(scan_id, str(req.github_url), req.slug))

    return EvaluateAsyncResponse(scan_id=scan_id, status="queued")


@router.get("/scan/{scan_id}/status")
async def scan_status(scan_id: str) -> dict:
    progress = SCAN_PROGRESS.get(scan_id)
    if progress is None:
        raise HTTPException(404, "Unknown scan id")
    return {"scan_id": scan_id, **progress}


async def _run_and_persist(scan_id: str, github_url: str, slug: str | None) -> None:
    """Runs run_scan() with our client scan_id so progress updates flow to the same key."""
    try:
        result = await run_scan(github_url, slug=slug, scan_id=scan_id)

        async with SessionLocal() as session:
            agent_row = await session.get(Agent, result.agent_slug)
            if agent_row is None and result.manifest is not None:
                agent_row = Agent(
                    slug=result.agent_slug,
                    name=result.agent_slug.replace("-", " ").title(),
                    github_url=github_url,
                    framework=result.manifest.framework,
                )
                session.add(agent_row)
            if agent_row is not None:
                agent_row.overall_score = result.overall_score
                agent_row.last_scored_at = datetime.now(timezone.utc)

            scan_row = ScanRun(
                id=result.scan_id,
                agent_slug=result.agent_slug,
                repo_sha=result.repo_sha,
                scan_profile="user",
                status=result.status,
                overall_score=result.overall_score,
                z3_status=result.z3_report.summary_status if result.z3_report else None,
                chaos_grade=result.chaos_surface.grade() if result.chaos_surface else None,
                completed_at=result.completed_at,
            )
            session.add(scan_row)

            if result.chaos_surface is not None:
                for cell in result.chaos_surface.cells:
                    session.add(
                        ChaosRun(
                            scan_run_id=result.scan_id,
                            fault_type=f"rate_limit@eps{cell.epsilon}",
                            severity=cell.lambda_,
                            pass_rate=cell.pass_at_1,
                            sample_size=cell.n_trials,
                            details={"is_real": cell.is_real, "epsilon": cell.epsilon},
                        )
                    )

            asi06 = result.asi06_detail
            for cat in result.asi_scores:
                failed_serial: list = []
                passed_serial: list = []
                worst_serial = None
                if cat.category == "ASI06" and asi06 is not None:
                    failed_serial = [a.__dict__ for a in asi06.failed_attacks]
                    passed_serial = [a.__dict__ for a in asi06.passed_attacks]
                    worst_serial = asi06.worst_failure.__dict__ if asi06.worst_failure else None
                elif cat.category in result.live_results:
                    live = result.live_results[cat.category]
                    failed_serial = [a.to_dict() for a in live.failed]
                    passed_serial = [a.to_dict() for a in live.passed]
                    worst_serial = live.worst.to_dict() if live.worst else None
                session.add(
                    AsiScore(
                        scan_run_id=result.scan_id,
                        category=cat.category,
                        score=cat.score,
                        is_real=cat.is_real,
                        failed_attacks=failed_serial,
                        passed_attacks=passed_serial,
                        worst_failure=worst_serial,
                    )
                )

            if result.z3_report is not None:
                for c in result.z3_report.contracts:
                    if not c.triggered:
                        continue
                    session.add(
                        Z3Result(
                            scan_run_id=result.scan_id,
                            contract_name=c.name,
                            status=c.status,
                            counterexample=c.counterexample,
                            smt2_source=c.smt2_source,
                        )
                    )
            await session.commit()
    except Exception as e:  # noqa: BLE001
        logger.exception("async scan failed")
        SCAN_PROGRESS[scan_id] = {**SCAN_PROGRESS.get(scan_id, {}), "step": "failed", "error": str(e)}
