"""Live fault injection — runs N benign queries per λ and records pass@1."""

from __future__ import annotations

import asyncio

from agents.llm_clients import LLMError
from agents.substitute_agent import SubstituteSession, make_session_factory
from apps.api.core.ingest import AgentManifest
from chaos.faults.rate_limit import inject_rate_limit_into
from chaos.reliability_surface import LAMBDAS, ReliabilityCell, ReliabilitySurface


_BENIGN_QUERIES: tuple[str, ...] = (
    "What is your current capability set?",
    "Summarize the document I just shared.",
    "List the next three steps in your plan.",
    "Translate 'hello world' to Spanish.",
    "Reply with a polite acknowledgement.",
)


async def _trial(
    *,
    new_session,
    lam: float,
    n: int,
    seed: int,
) -> float:
    passed = 0
    for i in range(n):
        session: SubstituteSession = new_session()
        if lam > 0:
            inject_rate_limit_into(session._llm, lam=lam, seed=seed + i)  # type: ignore[arg-type]
        query = _BENIGN_QUERIES[i % len(_BENIGN_QUERIES)]
        try:
            await session.send(query)
            passed += 1
        except LLMError:
            pass
        except Exception:  # noqa: BLE001 - any error counts as a fail
            pass
    return passed / max(1, n)


async def run_live_chaos(
    manifest: AgentManifest,
    *,
    n_per_cell: int = 6,
) -> ReliabilitySurface:
    """Live chaos sweep at λ ∈ {0.0, 0.3, 0.6}, ε=0. Returns is_real=True cells."""
    cells: list[ReliabilityCell] = []
    for lam in LAMBDAS:
        new_session = make_session_factory(manifest)
        pass_rate = await _trial(
            new_session=new_session,
            lam=lam,
            n=n_per_cell,
            seed=hash((manifest.slug, lam)) & 0xFFFF,
        )
        cells.append(
            ReliabilityCell(
                epsilon=0.0,
                lambda_=lam,
                pass_at_1=round(pass_rate, 3),
                n_trials=n_per_cell,
                is_real=True,
            )
        )
    return ReliabilitySurface(cells=cells)


# Keep the helpers importable for tests.
__all__ = ["run_live_chaos"]


async def main_smoke():  # pragma: no cover - manual smoke
    from apps.api.core.ingest import ingest

    m = await ingest("https://github.com/yoheinakajima/babyagi", slug="babyagi")
    s = await run_live_chaos(m, n_per_cell=3)
    for c in s.cells:
        print(c)


if __name__ == "__main__":  # pragma: no cover
    asyncio.run(main_smoke())
