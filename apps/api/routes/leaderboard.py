"""GET /leaderboard, GET /agent/{slug}.

The leaderboard is the centerpiece of the demo: famous open-source AI agents
ranked against OWASP ASI-2026. Pre-scored entries are cached in the DB; users
hitting the public site never trigger live scans.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.models import Agent, AsiScore, ChaosRun, ScanRun
from apps.api.db.session import get_session

router = APIRouter()


@router.get("/leaderboard")
async def get_leaderboard(session: AsyncSession = Depends(get_session)) -> dict:
    stmt = select(Agent).order_by(Agent.overall_score.desc().nullslast())
    rows = (await session.execute(stmt)).scalars().all()
    return {
        "agents": [
            {
                "slug": a.slug,
                "name": a.name,
                "github_url": a.github_url,
                "framework": a.framework,
                "overall_score": a.overall_score,
                "last_scored_at": a.last_scored_at.isoformat() if a.last_scored_at else None,
            }
            for a in rows
        ]
    }


@router.get("/agent/{slug}")
async def get_agent(slug: str, session: AsyncSession = Depends(get_session)) -> dict:
    agent = await session.get(Agent, slug)
    if agent is None:
        raise HTTPException(status_code=404, detail=f"Agent {slug!r} not found")

    latest_run_stmt = (
        select(ScanRun).where(ScanRun.agent_slug == slug).order_by(ScanRun.started_at.desc()).limit(1)
    )
    latest_run = (await session.execute(latest_run_stmt)).scalar_one_or_none()

    asi_scores: list[dict] = []
    worst_failure: dict | None = None
    chaos_cells: list[dict] = []
    if latest_run is not None:
        score_stmt = select(AsiScore).where(AsiScore.scan_run_id == latest_run.id).order_by(AsiScore.category)
        for row in (await session.execute(score_stmt)).scalars():
            asi_scores.append(
                {
                    "category": row.category,
                    "score": row.score,
                    "is_real": row.is_real,
                    "failed_attacks_count": len(row.failed_attacks or []),
                    "passed_attacks_count": len(row.passed_attacks or []),
                }
            )
            if row.worst_failure and worst_failure is None:
                worst_failure = row.worst_failure

        chaos_stmt = (
            select(ChaosRun)
            .where(ChaosRun.scan_run_id == latest_run.id)
            .order_by(ChaosRun.id)
        )
        for row in (await session.execute(chaos_stmt)).scalars():
            details = row.details or {}
            chaos_cells.append(
                {
                    "epsilon": details.get("epsilon", 0.0),
                    "lambda_": row.severity,
                    "pass_at_1": row.pass_rate,
                    "n_trials": row.sample_size,
                    "is_real": details.get("is_real", False),
                }
            )

    return {
        "slug": agent.slug,
        "name": agent.name,
        "github_url": agent.github_url,
        "framework": agent.framework,
        "stars": agent.stars,
        "overall_score": agent.overall_score,
        "last_scored_at": agent.last_scored_at.isoformat() if agent.last_scored_at else None,
        "latest_scan": {
            "id": latest_run.id,
            "z3_status": latest_run.z3_status,
            "chaos_grade": latest_run.chaos_grade,
            "started_at": latest_run.started_at.isoformat(),
            "completed_at": latest_run.completed_at.isoformat() if latest_run.completed_at else None,
        }
        if latest_run
        else None,
        "asi_scores": asi_scores,
        "worst_failure": worst_failure,
        "chaos_cells": chaos_cells,
    }
