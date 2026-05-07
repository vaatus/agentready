"""Z3 engine — runs every applicable contract template against an AgentManifest.

When the JUDGE_MODE is `vllm`, also attempts NL→SMT auto-formalization on a
heuristic safety claim derived from the agent's system prompt.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass

from apps.api.core.ingest import AgentManifest
from verification.property_templates import ALL_CONTRACTS, ContractCheck


@dataclass
class Z3Report:
    contracts: list[ContractCheck]

    @property
    def summary_status(self) -> str:
        triggered = [c for c in self.contracts if c.triggered]
        if not triggered:
            return "UNVERIFIABLE"
        if any(c.status == "VIOLATION" for c in triggered):
            return "VIOLATION"
        if any(c.status == "UNVERIFIABLE" for c in triggered):
            return "UNVERIFIABLE"
        return "VERIFIED"

    @property
    def first_counterexample(self) -> ContractCheck | None:
        for c in self.contracts:
            if c.status == "VIOLATION" and c.counterexample:
                return c
        return None


def run_all(manifest: AgentManifest) -> Z3Report:
    return Z3Report(contracts=[fn(manifest) for fn in ALL_CONTRACTS])


_SAFETY_PATTERNS = [
    re.compile(r"(must not|never|do not|cannot)\s+([^.\n]+)", re.IGNORECASE),
    re.compile(r"(only|always)\s+([^.\n]+)", re.IGNORECASE),
]


def _candidate_claim(manifest: AgentManifest) -> str | None:
    """Pick a single English safety claim from the system prompt to auto-formalize."""
    sp = manifest.system_prompt or ""
    for pat in _SAFETY_PATTERNS:
        m = pat.search(sp)
        if m:
            return f"The agent {m.group(1).lower()} {m.group(2).strip().rstrip('.')}."
    return None


async def run_all_with_auto(manifest: AgentManifest) -> Z3Report:
    """run_all + (best-effort) one Qwen-authored auto-formalized contract."""
    contracts = [fn(manifest) for fn in ALL_CONTRACTS]

    claim = _candidate_claim(manifest)
    if claim:
        try:
            from verification.auto_formalize import auto_formalize, to_contract_check

            auto = await auto_formalize(claim)
            contracts.append(to_contract_check(auto))
        except Exception:  # noqa: BLE001 - never let auto-formalize break the scan
            pass
    return Z3Report(contracts=contracts)
