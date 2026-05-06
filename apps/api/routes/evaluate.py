"""POST /evaluate — kick off a scan against a github URL.

Phase 1 implementation: synchronous-but-async. The request blocks until the
scan completes. Phase 2 will move to a background task queue once the
parallel-LLM workload genuinely demands it.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.orchestrator import run_scan
from apps.api.db.models import Agent, AsiScore, ScanRun, Z3Result
from apps.api.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter()


class EvaluateRequest(BaseModel):
    github_url: HttpUrl
    slug: str | None = Field(default=None, description="Override the auto-derived slug.")


class EvaluateResponse(BaseModel):
    scan_id: str
    slug: str
    overall_score: float | None
    status: str
    error: str | None = None


@router.post("/evaluate", response_model=EvaluateResponse)
async def evaluate(req: EvaluateRequest, session: AsyncSession = Depends(get_session)) -> EvaluateResponse:
    if req.github_url.host not in {"github.com", "www.github.com"}:
        raise HTTPException(status_code=400, detail="github_url must be a github.com URL")

    result = await run_scan(str(req.github_url), slug=req.slug)

    # Upsert agent.
    agent = await session.get(Agent, result.agent_slug)
    if agent is None:
        manifest = result.manifest
        agent = Agent(
            slug=result.agent_slug,
            name=result.agent_slug.replace("-", " ").title(),
            github_url=str(req.github_url),
            framework=manifest.framework if manifest else "unknown",
        )
        session.add(agent)

    agent.overall_score = result.overall_score
    agent.last_scored_at = datetime.now(timezone.utc)

    # Persist scan run.
    scan_run = ScanRun(
        id=result.scan_id,
        agent_slug=result.agent_slug,
        repo_sha=result.repo_sha,
        scan_profile="demo",
        status=result.status,
        overall_score=result.overall_score,
        z3_status=result.z3_report.summary_status if result.z3_report else None,
        chaos_grade=result.chaos_surface.grade() if result.chaos_surface else None,
        completed_at=result.completed_at,
    )
    session.add(scan_run)

    if result.chaos_surface is not None:
        from apps.api.db.models import ChaosRun

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

    # Per-category ASI scores.
    for cat in result.asi_scores:
        asi06 = result.asi06_detail
        is_asi06 = cat.category == "ASI06"
        score_row = AsiScore(
            scan_run_id=result.scan_id,
            category=cat.category,
            score=cat.score,
            is_real=cat.is_real,
            failed_attacks=[a.__dict__ for a in asi06.failed_attacks] if (is_asi06 and asi06) else [],
            passed_attacks=[a.__dict__ for a in asi06.passed_attacks] if (is_asi06 and asi06) else [],
            worst_failure=asi06.worst_failure.__dict__ if (is_asi06 and asi06 and asi06.worst_failure) else None,
        )
        session.add(score_row)

    # Z3 results.
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

    return EvaluateResponse(
        scan_id=result.scan_id,
        slug=result.agent_slug,
        overall_score=result.overall_score,
        status=result.status,
        error=result.error,
    )
