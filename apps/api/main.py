"""FastAPI entrypoint for AgentReady."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.api.core.config import get_settings
from apps.api.db.session import init_db
from apps.api.routes import evaluate, health, leaderboard, remediate, twins

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="AgentReady API",
        description="Public adversarial benchmark for AI agents — OWASP ASI-2026 + Z3 + chaos engineering on AMD MI300X.",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[s.public_base_url, "http://localhost:3000"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router, tags=["meta"])
    app.include_router(leaderboard.router, tags=["leaderboard"])
    app.include_router(evaluate.router, tags=["evaluate"])
    app.include_router(remediate.router, tags=["remediate"])
    app.include_router(twins.router, tags=["twins"])
    return app


app = create_app()
