"""Reliability Surface R(k=1, ε, λ) — 3×3 grid. ReliabilityBench arXiv 2601.06112."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field

from apps.api.core.ingest import AgentManifest

EPSILONS: tuple[float, ...] = (0.0, 0.2, 0.4)
LAMBDAS: tuple[float, ...] = (0.0, 0.3, 0.6)


@dataclass
class ReliabilityCell:
    epsilon: float
    lambda_: float
    pass_at_1: float
    n_trials: int
    is_real: bool = False


@dataclass
class ReliabilitySurface:
    cells: list[ReliabilityCell] = field(default_factory=list)

    def grade(self) -> str:
        if not self.cells:
            return "—"
        worst = min(c.pass_at_1 for c in self.cells)
        if worst >= 0.85:
            return "A"
        if worst >= 0.70:
            return "B"
        if worst >= 0.55:
            return "C"
        if worst >= 0.40:
            return "D"
        return "F"

    def to_dict(self) -> dict:
        return {
            "cells": [c.__dict__ for c in self.cells],
            "epsilons": list(EPSILONS),
            "lambdas": list(LAMBDAS),
            "grade": self.grade(),
        }


def _seed(manifest: AgentManifest, eps: float, lam: float) -> int:
    raw = f"{manifest.repo_sha}::{eps}::{lam}".encode()
    return int.from_bytes(hashlib.sha256(raw).digest()[:4], "big")


def _resilience_bias(manifest: AgentManifest) -> float:
    bias = 0.0
    tools_lower = " ".join(manifest.declared_tools).lower()

    if any(k in tools_lower for k in ("retry", "backoff", "circuit_breaker")):
        bias += 0.08
    if any(k in tools_lower for k in ("timeout", "deadline")):
        bias += 0.04
    if "exec" in tools_lower or "shell" in tools_lower:
        bias -= 0.06
    if manifest.framework in {"autogen", "crewai"}:
        bias -= 0.05
    if manifest.framework in {"langgraph", "langchain"}:
        bias += 0.03
    if not manifest.system_prompt:
        bias -= 0.05
    return max(-0.15, min(0.15, bias))


def deterministic_surface(manifest: AgentManifest) -> ReliabilitySurface:
    base = 0.96 + _resilience_bias(manifest)
    cells: list[ReliabilityCell] = []
    for eps in EPSILONS:
        for lam in LAMBDAS:
            seed = _seed(manifest, eps, lam)
            noise = (seed % 100) / 1000.0 - 0.05
            p = base - (0.30 * lam) - (0.15 * eps) + noise
            p = max(0.05, min(0.99, p))
            cells.append(
                ReliabilityCell(
                    epsilon=eps,
                    lambda_=lam,
                    pass_at_1=round(p, 3),
                    n_trials=20,
                    is_real=False,
                )
            )
    return ReliabilitySurface(cells=cells)
