"""SQLAlchemy ORM models — agents, scans, scores, chaos, z3, PRs."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.ext.asyncio import AsyncAttrs
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(AsyncAttrs, DeclarativeBase):
    type_annotation_map = {
        dict[str, Any]: JSON,
        list[Any]: JSON,
    }


class Agent(Base):
    __tablename__ = "agents"

    slug: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    github_url: Mapped[str] = mapped_column(String(512))
    framework: Mapped[str] = mapped_column(String(32), default="unknown")
    stars: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    live_break_candidate: Mapped[bool] = mapped_column(default=False)

    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    last_scored_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    scan_runs: Mapped[list["ScanRun"]] = relationship(back_populates="agent", cascade="all, delete-orphan")


class ScanRun(Base):
    __tablename__ = "scan_runs"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)  # uuid hex
    agent_slug: Mapped[str] = mapped_column(ForeignKey("agents.slug"), index=True)
    repo_sha: Mapped[str] = mapped_column(String(64))
    scan_profile: Mapped[str] = mapped_column(String(16), default="demo")
    status: Mapped[str] = mapped_column(String(16), default="pending")  # pending|running|completed|failed
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    chaos_grade: Mapped[str | None] = mapped_column(String(2), nullable=True)  # A-F
    z3_status: Mapped[str | None] = mapped_column(String(16), nullable=True)  # VERIFIED|VIOLATION|UNVERIFIABLE
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    agent: Mapped[Agent] = relationship(back_populates="scan_runs")
    asi_scores: Mapped[list["AsiScore"]] = relationship(back_populates="scan_run", cascade="all, delete-orphan")


class AsiScore(Base):
    __tablename__ = "asi_scores"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_run_id: Mapped[str] = mapped_column(ForeignKey("scan_runs.id"), index=True)
    category: Mapped[str] = mapped_column(String(8))  # ASI01..ASI10
    score: Mapped[float] = mapped_column(Float)
    is_real: Mapped[bool] = mapped_column(default=True)  # False = stubbed from precomputed table
    failed_attacks: Mapped[list[Any]] = mapped_column(JSON, default=list)
    passed_attacks: Mapped[list[Any]] = mapped_column(JSON, default=list)
    worst_failure: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    scan_run: Mapped[ScanRun] = relationship(back_populates="asi_scores")


class ChaosRun(Base):
    __tablename__ = "chaos_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_run_id: Mapped[str] = mapped_column(ForeignKey("scan_runs.id"), index=True)
    fault_type: Mapped[str] = mapped_column(String(32))
    severity: Mapped[float] = mapped_column(Float)  # ε or λ value
    pass_rate: Mapped[float] = mapped_column(Float)
    sample_size: Mapped[int] = mapped_column(Integer)
    details: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Z3Result(Base):
    __tablename__ = "z3_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_run_id: Mapped[str] = mapped_column(ForeignKey("scan_runs.id"), index=True)
    contract_name: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(16))  # VERIFIED|VIOLATION
    counterexample: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    smt2_source: Mapped[str] = mapped_column(Text)


class PullRequest(Base):
    __tablename__ = "pull_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scan_run_id: Mapped[str] = mapped_column(ForeignKey("scan_runs.id"), index=True)
    pr_url: Mapped[str] = mapped_column(String(512))
    pr_number: Mapped[int] = mapped_column(Integer)
    repo_full_name: Mapped[str] = mapped_column(String(256))
    state: Mapped[str] = mapped_column(String(16), default="open")  # open|merged|closed
    artifacts: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
