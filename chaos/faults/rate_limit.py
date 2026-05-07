"""Rate-limit fault — wraps an LLM client so probability λ of calls raise 429."""

from __future__ import annotations

import random

from agents.llm_clients import LLMError, _BaseLLMClient


def inject_rate_limit_into(client: _BaseLLMClient, *, lam: float, seed: int = 1337) -> None:
    original_chat = client._chat
    rng = random.Random(seed)

    async def patched_chat(*args, **kwargs):  # type: ignore[no-untyped-def]
        if rng.random() < lam:
            raise LLMError("Simulated 429 — rate limit (chaos injection)")
        return await original_chat(*args, **kwargs)

    client._chat = patched_chat  # type: ignore[assignment,method-assign]
