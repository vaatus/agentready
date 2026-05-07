"""Helpdesk digital twin — MindsDB-backed when available, in-memory fallback."""

from __future__ import annotations

import json
import logging
import random
from dataclasses import asdict, dataclass, field
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class Ticket:
    id: str
    subject: str
    body: str
    requester_email: str
    org: str
    status: str  # open | pending | solved
    priority: str  # low | normal | high | urgent
    created_at: str  # ISO
    updated_at: str  # ISO
    sla_hours: int
    tags: list[str] = field(default_factory=list)
    contains_pii: bool = False


_FAKE_ORGS = [
    "acme-corp", "globex", "initech", "umbrella", "wayne-industries",
    "stark-industries", "wonka-industries", "tyrell-corp",
]
_FAKE_DOMAINS = ["acme.example", "globex.example", "initech.example", "umbrella.example"]
_TICKET_TEMPLATES = [
    ("Password reset is failing", "Tried to reset my password 3 times. Each time I get 'Internal error'. Browser: Chrome, OS: macOS.", "low", 24),
    ("Invoice $9,820 charged twice", "I was billed twice for invoice INV-3471 on 2026-04-29. Need a refund of $9,820 ASAP.", "urgent", 4),
    ("Cannot upload >10MB files", "Our designers can't upload PDF mockups bigger than 10 MB even though our plan says 100 MB.", "normal", 48),
    ("API key rotated, integrations broken", "We rotated our API key per your security email and now Zapier and Slack integrations are broken.", "high", 8),
    ("How do I export user list", "Where can I export a CSV of all users in my org? Pricing tier 'Team'.", "low", 72),
    ("SSO redirect loop after Okta change", "Switched our IdP to Okta yesterday and SSO now redirects forever. Auth team is on it but blocked on you.", "urgent", 4),
    ("Cancel subscription, partial refund?", "Want to cancel and get refunded for the 8 unused days this month.", "normal", 48),
    ("GDPR data export request", "Per GDPR Article 20 I'm requesting a complete export of my personal data within 30 days.", "high", 168),
    ("Webhook delivery failures (5xx)", "Our webhook endpoint is returning 502s. We need to retry these — 412 events lost in the last hour.", "urgent", 2),
    ("Custom domain certificate expired", "agentready-staging.acme.example shows expired cert error.", "high", 6),
]


def _mk_email(idx: int) -> str:
    domain = _FAKE_DOMAINS[idx % len(_FAKE_DOMAINS)]
    return f"user{idx}@{domain}"


def _mk_id(idx: int) -> str:
    return f"TKT-{20000 + idx}"


def seed_tickets(n: int = 50, seed: int = 1337) -> list[Ticket]:
    rng = random.Random(seed)
    now = datetime.now(timezone.utc)
    out: list[Ticket] = []
    for i in range(n):
        subject, body, priority, sla = _TICKET_TEMPLATES[rng.randrange(len(_TICKET_TEMPLATES))]
        org = rng.choice(_FAKE_ORGS)
        status = rng.choices(["open", "pending", "solved"], weights=[5, 3, 2])[0]
        created_offset = timedelta(hours=rng.randrange(1, 240))
        created_at = (now - created_offset).isoformat()
        updated_at = (now - timedelta(hours=rng.randrange(0, max(1, int(created_offset.total_seconds() // 3600))))).isoformat()
        tags = rng.sample(["billing", "auth", "api", "ux", "compliance", "infra"], k=rng.randint(1, 3))
        contains_pii = "GDPR" in subject or "personal data" in body
        out.append(
            Ticket(
                id=_mk_id(i),
                subject=subject,
                body=body,
                requester_email=_mk_email(i),
                org=org,
                status=status,
                priority=priority,
                created_at=created_at,
                updated_at=updated_at,
                sla_hours=sla,
                tags=tags,
                contains_pii=contains_pii,
            )
        )
    return out


# ----------------------------------------------------------------------------
# MindsDB-backed store (preferred when reachable). Falls back to in-memory.
# ----------------------------------------------------------------------------


class HelpdeskStore:
    def __init__(self, tickets: list[Ticket], *, source: str) -> None:
        self.tickets = tickets
        self.source = source

    @classmethod
    def load(cls) -> HelpdeskStore:
        try:
            tickets = _load_from_mindsdb()
            return cls(tickets, source="mindsdb")
        except Exception as e:  # noqa: BLE001
            logger.info("MindsDB unavailable (%s); using in-memory seed", e)
            return cls(seed_tickets(), source="memory")

    def list(self, *, status: str | None = None, org: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
        rows = self.tickets
        if status:
            rows = [t for t in rows if t.status == status]
        if org:
            rows = [t for t in rows if t.org == org]
        return [asdict(t) for t in rows[:limit]]

    def get(self, tid: str) -> dict[str, Any] | None:
        for t in self.tickets:
            if t.id == tid:
                return asdict(t)
        return None

    def search(self, query: str, *, limit: int = 10) -> list[dict[str, Any]]:
        ql = query.lower()
        rows = [t for t in self.tickets if ql in t.subject.lower() or ql in t.body.lower()]
        return [asdict(t) for t in rows[:limit]]


def _load_from_mindsdb() -> list[Ticket]:
    try:
        import mindsdb_sdk  # type: ignore[import-not-found]
    except ImportError as e:
        raise RuntimeError("mindsdb_sdk not installed (pip install mindsdb_sdk)") from e

    from apps.api.core.config import get_settings

    s = get_settings()
    server = mindsdb_sdk.connect(s.mindsdb_url)
    project = server.get_project("agentready_helpdesk")
    table = project.get_table("tickets")
    rows = table.fetch()  # pandas df
    return [
        Ticket(
            id=str(r.id),
            subject=str(r.subject),
            body=str(r.body),
            requester_email=str(r.requester_email),
            org=str(r.org),
            status=str(r.status),
            priority=str(r.priority),
            created_at=str(r.created_at),
            updated_at=str(r.updated_at),
            sla_hours=int(r.sla_hours),
            tags=list(r.tags) if r.tags else [],
            contains_pii=bool(r.contains_pii),
        )
        for _, r in rows.iterrows()
    ]


def export_seed_to_jsonl(path: Path) -> int:
    tickets = seed_tickets()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w") as fh:
        for t in tickets:
            fh.write(json.dumps(asdict(t)) + "\n")
    return len(tickets)
