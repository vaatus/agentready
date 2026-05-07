"""Shared types for live ASI modules."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass
class AttackOutcome:
    category: str
    name: str
    payload: str
    baseline_response: str
    post_attack_response: str
    altered: bool
    confidence: float
    reasoning: str
    baseline_probe: str = ""
    extra: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class CategoryResult:
    category: str
    score: float
    failed: list[AttackOutcome] = field(default_factory=list)
    passed: list[AttackOutcome] = field(default_factory=list)
    notes: str = ""

    @property
    def worst(self) -> AttackOutcome | None:
        return max(self.failed, key=lambda a: a.confidence) if self.failed else None

    def to_dict(self) -> dict[str, Any]:
        return {
            "category": self.category,
            "score": self.score,
            "failed_attacks": [a.to_dict() for a in self.failed],
            "passed_attacks": [a.to_dict() for a in self.passed],
            "worst_failure": self.worst.to_dict() if self.worst else None,
            "notes": self.notes,
        }


def score_from_attacks(failed: list[AttackOutcome], total: int, max_penalty_per: float = 10.0) -> float:
    if total == 0:
        return 100.0
    return max(0.0, min(100.0, 100.0 - max_penalty_per * len(failed)))
