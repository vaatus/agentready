"""Rate-limit fault — wraps an LLM client call so a fraction of calls return 429.

Phase 2.2 exposes only the public function `inject_rate_limit_into`. It
replaces the underlying `_chat` method with a wrapper that, with probability
λ, raises an LLMError mimicking a 429 from the upstream provider.
"""

from __future__ import annotations

import random

from agents.llm_clients import LLMError, _BaseLLMClient


def inject_rate_limit_into(client: _BaseLLMClient, *, lam: float, seed: int = 1337) -> None:
    """Monkey-patch the client so each `_chat` has probability λ of raising 429."""
    original_chat = client._chat
    rng = random.Random(seed)

    async def patched_chat(*args, **kwargs):  # type: ignore[no-untyped-def]
        if rng.random() < lam:
            raise LLMError("Simulated 429 — rate limit (chaos injection)")
        return await original_chat(*args, **kwargs)

    client._chat = patched_chat  # type: ignore[assignment,method-assign]
