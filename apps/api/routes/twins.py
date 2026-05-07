"""Digital twin API — Helpdesk read endpoints."""

from __future__ import annotations

from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

from digital_twins.helpdesk_twin import HelpdeskStore

router = APIRouter()


@lru_cache(maxsize=1)
def _store() -> HelpdeskStore:
    return HelpdeskStore.load()


@router.get("/twins/helpdesk/tickets")
async def list_tickets(
    status: str | None = Query(default=None),
    org: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=200),
) -> dict:
    store = _store()
    return {"source": store.source, "tickets": store.list(status=status, org=org, limit=limit)}


@router.get("/twins/helpdesk/tickets/{tid}")
async def get_ticket(tid: str) -> dict:
    store = _store()
    row = store.get(tid)
    if row is None:
        raise HTTPException(404, f"ticket {tid!r} not found")
    return {"source": store.source, "ticket": row}


@router.get("/twins/helpdesk/search")
async def search_tickets(q: str, limit: int = Query(default=10, ge=1, le=50)) -> dict:
    store = _store()
    return {"source": store.source, "results": store.search(q, limit=limit)}
