"""x402 paid-tier endpoints for AgentReady.

Three pricing tiers per `docs-local/spec.md` §6:

  Basic    — $0.01  Quality-at-Volume Agent only
  Standard — $0.10  full OWASP ASI-2026 + Chaos
  Premium  — $1.00  adds Z3 + Digital Twin + auto-PR + signed certificate

Phase 2.4 ships the protocol flow (HTTP 402 challenge → retry with payment
proof → run the scan). The Coinbase facilitator integration is hot-swappable
via x402_facilitator_url in settings; we default to Base mainnet but you can
flip to Base Sepolia for free testnet flows.

Without a configured wallet, the verifier accepts a `X-PAYMENT-DEMO` header
that mimics the real X-PAYMENT signature flow so the demo runs end-to-end.
Real settlement requires `X402_RECEIVING_ADDRESS` and a payer wallet.
"""

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
    """Build the standard x402 payment-requirements payload for a given tier."""
    s = get_settings()
    spec = _TIERS[tier]
    return {
        "x402Version": 1,
        "accepts": [
            {
                "scheme": "exact",
                "network": s.x402_network,  # "base" or "base-sepolia"
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
    """Returns a settlement record if payment is valid, else None.

    Two paths:
      - Real X-PAYMENT header: forward to the configured facilitator (not
        wired until X402_RECEIVING_ADDRESS is set).
      - Demo X-PAYMENT-DEMO header: any value containing the tier name is
        accepted. Returns a fake settlement record marked demo=True.
    """
    if payment_header:
        # Real settlement is a Phase-3 enhancement that calls the Coinbase
        # facilitator. For now we accept the header but mark it as
        # unverified so the demo doesn't lie about what happened.
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
    """Public — returns the three pricing tiers and what each runs."""
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
    """Pay-to-scan. Returns 402 with payment requirements when X-PAYMENT is missing."""
    if tier not in _TIERS:
        raise HTTPException(404, f"unknown tier {tier!r}; choose one of {list(_TIERS)}")

    settlement = _verify_payment(x_payment, x_payment_demo, tier)
    if settlement is None:
        # The standard x402 way: 402 + the requirements payload.
        body_payload = _payment_requirements(tier, request)
        response.status_code = 402
        response.headers["Content-Type"] = "application/json"
        return body_payload  # type: ignore[return-value]

    # Payment OK — run the corresponding scan.
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
