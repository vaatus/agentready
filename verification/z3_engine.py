"""Z3 engine — runs every applicable contract template against an AgentManifest."""

from __future__ import annotations

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
