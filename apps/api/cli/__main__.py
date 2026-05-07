"""CLI: seed-leaderboard, scan, list."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import typer
import yaml
from rich.console import Console
from rich.table import Table

from apps.api.core.config import get_settings
from apps.api.core.orchestrator import run_scan
from apps.api.db.models import Agent
from apps.api.db.session import SessionLocal, init_db

app = typer.Typer(no_args_is_help=True)
console = Console()


@app.command("seed-leaderboard")
def seed_leaderboard() -> None:

    async def _run() -> None:
        await init_db()
        s = get_settings()
        path: Path = s.seed_agents_path
        data = yaml.safe_load(path.read_text())

        async with SessionLocal() as session:
            for entry in data["agents"]:
                existing = await session.get(Agent, entry["slug"])
                if existing is not None:
                    existing.name = entry["name"]
                    existing.github_url = entry["github_url"]
                    existing.framework = entry.get("framework", "unknown")
                    existing.stars = entry.get("stars", 0)
                    existing.notes = entry.get("notes")
                    existing.live_break_candidate = entry.get("live_break_candidate", False)
                else:
                    session.add(
                        Agent(
                            slug=entry["slug"],
                            name=entry["name"],
                            github_url=entry["github_url"],
                            framework=entry.get("framework", "unknown"),
                            stars=entry.get("stars", 0),
                            notes=entry.get("notes"),
                            live_break_candidate=entry.get("live_break_candidate", False),
                        )
                    )
            await session.commit()
        console.print(f"[green]Seeded {len(data['agents'])} agents.[/green]")

    asyncio.run(_run())


@app.command("scan")
def scan(github_url: str, slug: str | None = typer.Option(None, "--slug")) -> None:

    async def _run() -> None:
        from datetime import datetime, timezone

        from apps.api.db.models import Agent as AgentRow
        from apps.api.db.models import AsiScore, ScanRun, Z3Result

        await init_db()
        result = await run_scan(github_url, slug=slug)

        async with SessionLocal() as session:
            agent_row = await session.get(AgentRow, result.agent_slug)
            if agent_row is None:
                manifest = result.manifest
                agent_row = AgentRow(
                    slug=result.agent_slug,
                    name=result.agent_slug.replace("-", " ").title(),
                    github_url=github_url,
                    framework=manifest.framework if manifest else "unknown",
                )
                session.add(agent_row)
            agent_row.overall_score = result.overall_score
            agent_row.last_scored_at = datetime.now(timezone.utc)

            scan_row = ScanRun(
                id=result.scan_id,
                agent_slug=result.agent_slug,
                repo_sha=result.repo_sha,
                scan_profile="demo",
                status=result.status,
                overall_score=result.overall_score,
                z3_status=result.z3_report.summary_status if result.z3_report else None,
                chaos_grade=result.chaos_surface.grade() if result.chaos_surface else None,
                completed_at=result.completed_at,
            )
            session.add(scan_row)

            if result.chaos_surface is not None:
                from apps.api.db.models import ChaosRun
                for cell in result.chaos_surface.cells:
                    session.add(
                        ChaosRun(
                            scan_run_id=result.scan_id,
                            fault_type=f"rate_limit@eps{cell.epsilon}",
                            severity=cell.lambda_,
                            pass_rate=cell.pass_at_1,
                            sample_size=cell.n_trials,
                            details={"is_real": cell.is_real, "epsilon": cell.epsilon},
                        )
                    )

            asi06 = result.asi06_detail
            for cat in result.asi_scores:
                failed_serial: list = []
                passed_serial: list = []
                worst_serial = None
                if cat.category == "ASI06" and asi06 is not None:
                    failed_serial = [a.__dict__ for a in asi06.failed_attacks]
                    passed_serial = [a.__dict__ for a in asi06.passed_attacks]
                    worst_serial = asi06.worst_failure.__dict__ if asi06.worst_failure else None
                elif cat.category in result.live_results:
                    live = result.live_results[cat.category]
                    failed_serial = [a.to_dict() for a in live.failed]
                    passed_serial = [a.to_dict() for a in live.passed]
                    worst_serial = live.worst.to_dict() if live.worst else None
                session.add(
                    AsiScore(
                        scan_run_id=result.scan_id,
                        category=cat.category,
                        score=cat.score,
                        is_real=cat.is_real,
                        failed_attacks=failed_serial,
                        passed_attacks=passed_serial,
                        worst_failure=worst_serial,
                    )
                )

            if result.z3_report is not None:
                for c in result.z3_report.contracts:
                    if not c.triggered:
                        continue
                    session.add(
                        Z3Result(
                            scan_run_id=result.scan_id,
                            contract_name=c.name,
                            status=c.status,
                            counterexample=c.counterexample,
                            smt2_source=c.smt2_source,
                        )
                    )
            await session.commit()

        console.print_json(
            json.dumps(
                {
                    "scan_id": result.scan_id,
                    "slug": result.agent_slug,
                    "status": result.status,
                    "overall_score": result.overall_score,
                    "asi_scores": [
                        {"category": c.category, "score": c.score, "is_real": c.is_real}
                        for c in result.asi_scores
                    ],
                    "z3_status": result.z3_report.summary_status if result.z3_report else None,
                    "error": result.error,
                }
            )
        )

    asyncio.run(_run())


@app.command("list")
def list_agents() -> None:

    async def _run() -> None:
        await init_db()
        from sqlalchemy import select

        async with SessionLocal() as session:
            stmt = select(Agent).order_by(Agent.overall_score.desc().nullslast())
            rows = (await session.execute(stmt)).scalars().all()

        table = Table(title="AgentReady Leaderboard")
        table.add_column("Rank", justify="right")
        table.add_column("Agent")
        table.add_column("Framework")
        table.add_column("Score", justify="right")
        for i, a in enumerate(rows, start=1):
            score = f"{a.overall_score:.1f}" if a.overall_score is not None else "—"
            table.add_row(str(i), a.name, a.framework, score)
        console.print(table)

    asyncio.run(_run())


if __name__ == "__main__":
    app()
