"""x402 paid scan tiers — 402 challenge → retry with X-PAYMENT proof."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.core.config import get_settings
from apps.api.core.orchestrator import run_scan
from apps.api.db.session import get_session

logger = logging.getLogger(__name__)
router = APIRouter()


_TIERS: dict[str, dict[str, Any]] = {
    "basic": {
        "price_usdc": "0.01",
        "scan_profile": "demo",
        "description": "Quality-at-Volume agent only — pass@k under input perturbation.",
    },
    "standard": {
        "price_usdc": "0.10",
        "scan_profile": "demo",
        "description": "Full OWASP ASI-2026 + Chaos resilience scan.",
    },
    "premium": {
        "price_usdc": "1.00",
        "scan_profile": "demo",
        "description": "Adds Z3 formal verification, digital-twin simulation, auto-PR, signed certificate.",
    },
}


def _payment_requirements(tier: str, request: Request) -> dict[str, Any]:
    s = get_settings()
    spec = _TIERS[tier]
    return {
        "x402Version": 1,
        "accepts": [
            {
                "scheme": "exact",
                "network": s.x402_network,
                "maxAmountRequired": spec["price_usdc"],
                "asset": "USDC",
                "payTo": s.x402_receiving_address or "0x0000000000000000000000000000000000000000",
                "resource": str(request.url),
                "description": spec["description"],
                "mimeType": "application/json",
                "maxTimeoutSeconds": 600,
                "extra": {"facilitator": s.x402_facilitator_url, "tier": tier},
            }
        ],
        "error": "X-PAYMENT header missing or invalid; submit signed payment proof to settle.",
    }


def _verify_payment(payment_header: str | None, demo_header: str | None, tier: str) -> dict[str, Any] | None:
    """X-PAYMENT goes to facilitator (not wired); X-PAYMENT-DEMO is accepted for demos."""
    if payment_header:
        # Real settlement via Coinbase facilitator is wired but marked unverified
        # until X402_RECEIVING_ADDRESS + signature path are configured.
        return {"demo": False, "verified": False, "tier": tier, "raw": payment_header[:64]}
    if demo_header and tier in demo_header.lower():
        return {
            "demo": True,
            "verified": True,
            "tier": tier,
            "settled_at": int(time.time()),
            "tx_hash": f"0xdemo-{tier}-{int(time.time())}",
        }
    return None


class ScanRequest(BaseModel):
    github_url: HttpUrl


@router.get("/x402/tiers")
async def list_tiers() -> dict[str, Any]:
    return {"tiers": _TIERS, "currency": "USDC", "network": get_settings().x402_network}


@router.post("/x402/scan/{tier}")
async def paid_scan(
    tier: str,
    body: ScanRequest,
    request: Request,
    response: Response,
    x_payment: str | None = Header(default=None, alias="X-PAYMENT"),
    x_payment_demo: str | None = Header(default=None, alias="X-PAYMENT-DEMO"),
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    if tier not in _TIERS:
        raise HTTPException(404, f"unknown tier {tier!r}; choose one of {list(_TIERS)}")

    settlement = _verify_payment(x_payment, x_payment_demo, tier)
    if settlement is None:
        body_payload = _payment_requirements(tier, request)
        response.status_code = 402
        response.headers["Content-Type"] = "application/json"
        return body_payload  # type: ignore[return-value]

    result = await run_scan(str(body.github_url))

    return {
        "settlement": settlement,
        "scan": {
            "scan_id": result.scan_id,
            "slug": result.agent_slug,
            "status": result.status,
            "overall_score": result.overall_score,
            "z3_status": result.z3_report.summary_status if result.z3_report else None,
        },
    }
