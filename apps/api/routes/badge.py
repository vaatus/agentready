"""GET /agent/{slug}/badge.svg — Codecov-style badge for embedding in READMEs."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.db.models import Agent
from apps.api.db.session import get_session

router = APIRouter()


def _color(score: float | None) -> tuple[str, str]:
    """Return (right-side fill, label) for the badge."""
    if score is None:
        return "#9f9f9f", "—"
    if score >= 85:
        return "#3fb950", f"{score:.0f}/100"
    if score >= 70:
        return "#bf8700", f"{score:.0f}/100"
    if score >= 55:
        return "#d29922", f"{score:.0f}/100"
    return "#da3633", f"{score:.0f}/100"


_SVG_TEMPLATE = '''<svg xmlns="http://www.w3.org/2000/svg" width="180" height="20" role="img" aria-label="OWASP ASI-2026: {score_text}">
<title>OWASP ASI-2026: {score_text}</title>
<linearGradient id="s" x2="0" y2="100%">
  <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
  <stop offset="1" stop-opacity=".1"/>
</linearGradient>
<clipPath id="r"><rect width="180" height="20" rx="3" fill="#fff"/></clipPath>
<g clip-path="url(#r)">
  <rect width="120" height="20" fill="#222"/>
  <rect x="120" width="60" height="20" fill="{color}"/>
  <rect width="180" height="20" fill="url(#s)"/>
</g>
<g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
  <text x="60" y="14">OWASP ASI-2026</text>
  <text x="150" y="14">{score_text}</text>
</g>
</svg>'''


@router.get("/agent/{slug}/badge.svg")
async def badge(slug: str, session: AsyncSession = Depends(get_session)) -> Response:
    agent = await session.get(Agent, slug)
    score = agent.overall_score if agent else None
    color, label = _color(score)
    svg = _SVG_TEMPLATE.format(color=color, score_text=label)
    return Response(
        content=svg,
        media_type="image/svg+xml",
        # No cache so the badge updates immediately when the score changes.
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"},
    )
