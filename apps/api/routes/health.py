"""GET /health — liveness probe."""

from fastapi import APIRouter

from apps.api.core.config import get_settings

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    s = get_settings()
    return {
        "status": "ok",
        "service": "agentready",
        "scan_profile": s.scan_profile,
        "judge_endpoint": s.judge_llm_url,
        "red_endpoint": s.red_llm_url,
    }
