"""Live rate-limit chaos sweep at ε=0, λ ∈ {0.0, 0.3, 0.6}."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.ingest import ingest
from apps.api.db.models import Agent
from apps.api.db.session import get_session
from chaos.fault_injector import run_live_chaos

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/agent/{slug}/chaos/run-live")
async def run_live(slug: str, session: AsyncSession = Depends(get_session)) -> dict:
    agent = await session.get(Agent, slug)
    if agent is None:
        raise HTTPException(404, f"Agent {slug!r} not found")

    manifest = await ingest(agent.github_url, slug=slug)
    surface = await run_live_chaos(manifest, n_per_cell=4)
    return {
        "slug": slug,
        "cells": [
            {
                "epsilon": c.epsilon,
                "lambda_": c.lambda_,
                "pass_at_1": c.pass_at_1,
                "n_trials": c.n_trials,
                "is_real": c.is_real,
            }
            for c in surface.cells
        ],
        "grade": surface.grade(),
    }
