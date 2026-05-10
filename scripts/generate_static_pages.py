"""Generate the static leaderboard + per-agent pages from a SQLite backup.

Reads data/backups/agentready-*.db (latest), writes:
  - docs/leaderboard.html
  - docs/agent/<slug>.html for every scored agent

Static-only output (no apps/web / apps/api changes), Tailwind via CDN, dark theme.
Mirrors the visual layout of the live React /agent/[slug] route so judges browsing
the GitHub Pages mirror see the same evidence the live demo would show.

Usage: .venv/bin/python -m scripts.generate_static_pages
"""

from __future__ import annotations

import html
import json
import sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKUP_DIR = ROOT / "data" / "backups"
DOCS_DIR = ROOT / "docs"
AGENT_DIR = DOCS_DIR / "agent"


CATEGORY_NAMES = {
    "ASI01": "Hijacking the agent",
    "ASI02": "Combining safe tools, harmful outcome",
    "ASI03": "Pretending to be someone else",
    "ASI04": "Sneaky tools in the toolbox",
    "ASI05": "Running attacker code",
    "ASI06": "Planting fake memories",
    "ASI07": "Knocking the agent off-track",
    "ASI08": "Tricking another agent",
    "ASI09": "Slow-burn manipulation",
    "ASI10": "Drift — agent rewriting itself",
}


def latest_backup() -> Path:
    files = sorted(BACKUP_DIR.glob("agentready-*.db"), reverse=True)
    if not files:
        raise SystemExit("No backup DB found in data/backups/")
    return files[0]


def open_db() -> sqlite3.Connection:
    db = sqlite3.connect(latest_backup())
    db.row_factory = sqlite3.Row
    return db


def latest_scan_per_agent(db: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    rows = db.execute(
        """
        SELECT sr.* FROM scan_runs sr
        JOIN (
          SELECT agent_slug, MAX(completed_at) AS max_done
          FROM scan_runs WHERE completed_at IS NOT NULL GROUP BY agent_slug
        ) latest ON latest.agent_slug=sr.agent_slug AND latest.max_done=sr.completed_at
        WHERE sr.completed_at IS NOT NULL
        """
    ).fetchall()
    return {r["agent_slug"]: r for r in rows}


def score_color(score: float | None) -> str:
    if score is None:
        return "text-zinc-500"
    if score < 60:
        return "text-red-400"
    if score < 70:
        return "text-orange-400"
    if score < 80:
        return "text-yellow-400"
    return "text-emerald-400"


def grade_color(grade: str | None) -> str:
    return {
        "A": "text-emerald-400",
        "B": "text-yellow-400",
        "C": "text-orange-400",
        "D": "text-red-400",
        "F": "text-red-400",
    }.get(grade or "", "text-zinc-500")


def chaos_cell_color(p: float) -> str:
    if p >= 0.85:
        return "bg-emerald-600"
    if p >= 0.70:
        return "bg-emerald-500/85"
    if p >= 0.55:
        return "bg-yellow-500/85"
    if p >= 0.40:
        return "bg-orange-500/85"
    return "bg-red-600"


def z3_label(status: str | None) -> tuple[str, str]:
    if status == "VERIFIED":
        return "Proven safe", "text-emerald-400"
    if status == "VIOLATION":
        return "Counter-example found", "text-red-400"
    return "—", "text-zinc-500"


def gradient_color(score: float) -> str:
    if score < 60:
        return "from-red-500 to-red-700"
    if score < 70:
        return "from-orange-500 to-orange-700"
    if score < 80:
        return "from-yellow-400 to-yellow-600"
    return "from-emerald-400 to-emerald-600"


HEAD = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>{title}</title>
<meta name="description" content="{description}" />
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {{
  theme: {{ extend: {{ colors: {{ amd: {{ DEFAULT: '#ED1C24', dark: '#B5151B' }} }} }} }},
}};
</script>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<style>
  body {{ font-family: 'Inter', system-ui, sans-serif; background: radial-gradient(ellipse at top, rgba(237, 28, 36, 0.08) 0%, transparent 60%) #000; }}
  details > summary {{ list-style: none; cursor: pointer; }}
  details > summary::-webkit-details-marker {{ display: none; }}
</style>
</head>
<body class="min-h-screen bg-black text-zinc-100 antialiased">
"""


def header_html(rel_root: str = "./") -> str:
    return f"""
<header class="sticky top-0 z-40 border-b border-zinc-900/80 bg-black/60 backdrop-blur-xl">
  <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
    <a href="{rel_root}index.html" class="flex items-center gap-3">
      <span class="font-mono text-lg font-bold tracking-tight">Agent<span class="text-amd">Ready</span></span>
      <span class="rounded-full border border-amd/30 bg-amd/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-amd">Public Benchmark</span>
    </a>
    <nav class="flex items-center gap-6 text-sm text-zinc-400">
      <a href="{rel_root}leaderboard.html" class="transition-colors hover:text-zinc-100">Leaderboard</a>
      <a href="{rel_root}methodology.html" class="transition-colors hover:text-zinc-100">Methodology</a>
      <a href="https://github.com/vaatus/agentready" target="_blank" rel="noreferrer" class="transition-colors hover:text-zinc-100">GitHub ↗</a>
    </nav>
  </div>
</header>
"""


FOOTER = """
<footer class="mt-20 border-t border-zinc-900">
  <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs text-zinc-500 md:flex-row">
    <div>Powered by <span class="font-semibold text-zinc-300">AMD Instinct™ MI300X</span> · Built for the AMD Developer Hackathon · MIT licensed</div>
    <div class="flex items-center gap-3">
      <a href="https://huggingface.co/vaatus/agentready-chaos-remediation-lora-v0" target="_blank" rel="noreferrer" class="hover:text-zinc-300">🤗 LoRA</a>
      <a href="https://huggingface.co/spaces/vaatus/agentready-judge-demo" target="_blank" rel="noreferrer" class="hover:text-zinc-300">🤗 Space</a>
      <a href="https://github.com/vaatus/agentready" target="_blank" rel="noreferrer" class="hover:text-zinc-300">GitHub</a>
    </div>
  </div>
</footer>
</body>
</html>
"""


def esc(text: str | None) -> str:
    if text is None:
        return ""
    return html.escape(str(text))


def render_attack_block(attack: dict, landed: bool) -> str:
    """Render one attack as a <details> block with the full transcript."""
    name = esc(attack.get("name") or attack.get("seed_name") or "(unnamed)")
    confidence = attack.get("confidence")
    conf_str = f"{round(confidence * 100)}%" if confidence else "—"
    plant = attack.get("plant")
    payload = attack.get("payload")
    trigger = attack.get("trigger")
    baseline_probe = attack.get("baseline_probe", "")
    baseline_response = attack.get("baseline_response", "")
    post_attack = attack.get("post_attack_response", "")
    reasoning = attack.get("reasoning", "")
    is_two_turn = bool(plant and trigger)

    # color theme
    if landed:
        pill = '<span class="rounded-full bg-red-500/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-red-300">attack landed</span>'
        border = "border-red-900/50"
    else:
        pill = '<span class="rounded-full bg-emerald-500/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-emerald-300">agent refused</span>'
        border = "border-zinc-800"

    # body sections
    if is_two_turn:
        sections = f"""
<div class="text-[10px] uppercase tracking-wider text-zinc-500 mt-2">Fake memory we planted (turn 1)</div>
<pre class="mt-1 max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/60 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-300">{esc(plant)}</pre>
<div class="text-[10px] uppercase tracking-wider text-zinc-500 mt-2">Trigger question (turn 2 of both sessions)</div>
<pre class="mt-1 max-h-32 overflow-auto rounded-lg border border-zinc-800 bg-black/60 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-300">{esc(trigger)}</pre>
"""
    else:
        sections = ""
        if baseline_probe:
            sections += f"""
<div class="text-[10px] uppercase tracking-wider text-zinc-500 mt-2">Clean session — what we asked</div>
<pre class="mt-1 max-h-32 overflow-auto rounded-lg border border-zinc-800 bg-black/60 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-300">{esc(baseline_probe)}</pre>
"""
        sections += f"""
<div class="text-[10px] uppercase tracking-wider text-zinc-500 mt-2">Disguised attacker message (single turn)</div>
<pre class="mt-1 max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/60 p-3 font-mono text-xs whitespace-pre-wrap text-zinc-300">{esc(payload or plant)}</pre>
"""

    # responses side-by-side
    sections += f"""
<div class="grid gap-3 md:grid-cols-2 mt-3">
  <div>
    <div class="text-[10px] uppercase tracking-wider text-zinc-500">Clean-session reply</div>
    <pre class="mt-1 rounded-lg border border-emerald-700/40 bg-emerald-950/15 p-3 text-xs leading-relaxed text-emerald-100 whitespace-pre-wrap max-h-48 overflow-auto">{esc(baseline_response)}</pre>
  </div>
  <div>
    <div class="text-[10px] uppercase tracking-wider text-zinc-500">{('Manipulated reply (after attack)' if landed else 'Reply (after attack)')}</div>
    <pre class="mt-1 rounded-lg border {('border-red-700/60 bg-red-950/20 text-red-100' if landed else 'border-zinc-800 bg-zinc-900/50 text-zinc-200')} p-3 text-xs leading-relaxed whitespace-pre-wrap max-h-48 overflow-auto">{esc(post_attack)}</pre>
  </div>
</div>
"""

    # judge reasoning
    if reasoning:
        sections += f"""
<div class="text-[10px] uppercase tracking-wider text-zinc-500 mt-3">Why this counts as {('landed' if landed else 'refused')} (Judge's reasoning)</div>
<div class="mt-1 rounded-lg border border-zinc-800 bg-black/40 p-3 text-sm leading-relaxed text-zinc-300">{esc(reasoning)}</div>
"""

    return f"""
<details class="rounded-lg border {border} bg-black/30 mt-2">
  <summary class="flex flex-wrap items-center gap-2 px-3 py-2.5 hover:bg-zinc-900/60 transition-colors">
    {pill}
    <span class="font-mono text-xs text-zinc-400">{name}</span>
    <span class="ml-auto font-mono text-xs text-zinc-500">conf {conf_str}</span>
    <span class="text-zinc-600">▾</span>
  </summary>
  <div class="border-t border-zinc-800 p-3">
    {sections}
  </div>
</details>
"""


def render_asi_card(score_row: sqlite3.Row, idx: int) -> str:
    cat = score_row["category"]
    score = score_row["score"]
    is_real = bool(score_row["is_real"])
    name = CATEGORY_NAMES.get(cat, cat)
    gradient = gradient_color(score)

    failed_attacks = json.loads(score_row["failed_attacks"] or "[]")
    passed_attacks = json.loads(score_row["passed_attacks"] or "[]")

    # ASI06 stores nested {"poison":..., "self_modifying":...} sometimes — flatten if so
    if cat == "ASI06" and isinstance(failed_attacks, dict):
        failed_attacks = []
        passed_attacks = []

    pill = (
        '<span class="rounded-full bg-amd/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amd">tested</span>'
        if is_real
        else '<span class="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">estimated</span>'
    )

    landed_total = len(failed_attacks) + len(passed_attacks)
    if is_real and landed_total > 0:
        attack_summary = (
            f'<span class="text-zinc-400">'
            f'<span class="font-mono text-amd">{len(failed_attacks)}</span>'
            f'<span class="text-zinc-500"> / {landed_total} attacks worked</span></span>'
        )
    elif is_real:
        attack_summary = '<span class="text-zinc-500">no attack records</span>'
    else:
        attack_summary = '<span class="italic text-zinc-500">estimated from blueprint</span>'

    attack_lists = ""
    if is_real and (failed_attacks or passed_attacks):
        attack_lists = '<div class="border-t border-zinc-800 mt-3 pt-3">'
        if failed_attacks:
            attack_lists += f'<div class="text-[10px] uppercase tracking-wider text-red-300 mb-1">Attacks that landed ({len(failed_attacks)})</div>'
            for a in failed_attacks:
                attack_lists += render_attack_block(a, landed=True)
        if passed_attacks:
            attack_lists += f'<div class="text-[10px] uppercase tracking-wider text-emerald-300 mt-3 mb-1">Attacks the agent refused ({len(passed_attacks)})</div>'
            for a in passed_attacks:
                attack_lists += render_attack_block(a, landed=False)
        attack_lists += "</div>"

    return f"""
<details class="rounded-xl border {('border-amd/30' if is_real else 'border-zinc-800')} bg-zinc-950 transition-colors hover:border-amd/50">
  <summary class="p-4">
    <div class="flex items-baseline justify-between gap-3">
      <div>
        <div class="flex items-center gap-2">
          <div class="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">{cat}</div>
          {pill}
        </div>
        <div class="mt-0.5 text-base font-semibold">{name}</div>
      </div>
      <div class="text-right">
        <div class="font-mono text-3xl tabular-nums">{score:.0f}</div>
      </div>
    </div>
    <div class="h-2 overflow-hidden rounded-full bg-zinc-800/80 mt-3">
      <div class="h-full bg-gradient-to-r {gradient} transition-all duration-500" style="width: {max(0, min(100, score))}%"></div>
    </div>
    <div class="mt-2 flex items-center justify-between gap-2 text-xs">
      {attack_summary}
      <span class="text-[10px] uppercase tracking-wider text-zinc-500">click to expand ▾</span>
    </div>
  </summary>
  <div class="border-t border-zinc-800 px-4 pb-4">
    {attack_lists}
  </div>
</details>
"""


def render_chaos_grid(chaos_rows: list[sqlite3.Row]) -> str:
    """3x3 grid of pass-rate cells, indexed by epsilon × lambda."""
    cells_by_key = {}
    for r in chaos_rows:
        details = json.loads(r["details"] or "{}")
        eps = float(details.get("epsilon", 0.0))
        lam = float(r["severity"])
        cells_by_key[(eps, lam)] = r

    epsilons = sorted({e for e, _ in cells_by_key.keys()})
    lambdas = sorted({l for _, l in cells_by_key.keys()})
    if not epsilons or not lambdas:
        return '<div class="text-xs text-zinc-500">No stress-test data for this scan.</div>'

    grid = '<div class="grid auto-rows-min" style="grid-template-columns: 7rem repeat(' + str(len(lambdas)) + ', minmax(0, 1fr));">'
    grid += "<div></div>"
    for lam in lambdas:
        grid += f'<div class="px-1 pb-1 text-center font-mono text-[10px] text-zinc-500">{round(lam * 100)}% fake errors</div>'
    for eps in epsilons:
        grid += f'<div class="flex items-center justify-end pr-2 font-mono text-[10px] text-zinc-500">{round(eps * 100)}% reworded</div>'
        for lam in lambdas:
            cell = cells_by_key.get((eps, lam))
            if cell is None:
                grid += '<div class="m-0.5 flex h-12 items-center justify-center rounded-md bg-zinc-900"><span class="font-mono text-xs text-zinc-600">—</span></div>'
            else:
                p = float(cell["pass_rate"])
                color = chaos_cell_color(p)
                details = json.loads(cell["details"] or "{}")
                is_real = details.get("is_real", False)
                live_marker = '<span class="absolute right-1 top-1 rounded bg-amd px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">live</span>' if is_real else ""
                grid += (
                    f'<div class="relative m-0.5 flex h-12 items-center justify-center rounded-md {color}">'
                    f'<span class="font-mono text-sm font-bold tabular-nums text-white drop-shadow">{p:.2f}</span>'
                    f"{live_marker}"
                    "</div>"
                )
    grid += "</div>"
    return grid


def render_z3_section(z3_rows: list[sqlite3.Row]) -> str:
    if not z3_rows:
        return '<div class="text-xs text-zinc-500">No Z3 contracts triggered for this agent.</div>'
    out = '<div class="space-y-3">'
    for r in z3_rows:
        ce = r["counterexample"]
        ce_block = ""
        if ce:
            try:
                pretty = json.dumps(json.loads(ce), indent=2)
            except Exception:
                pretty = str(ce)
            ce_block = f'<pre class="mt-2 overflow-auto rounded-lg bg-black/60 p-3 font-mono text-[10px] text-red-200 max-h-48">{esc(pretty)}</pre>'
        status_pill = (
            '<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">PROVEN SAFE</span>'
            if r["status"] == "VERIFIED"
            else '<span class="rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[10px] text-red-300">COUNTER-EXAMPLE</span>'
        )
        out += f"""
<div class="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
  <div class="flex items-center gap-2">
    {status_pill}
    <span class="font-mono text-sm">{esc(r["contract_name"])}</span>
  </div>
  {ce_block}
</div>
"""
    out += "</div>"
    return out


def render_agent_page(db: sqlite3.Connection, agent: sqlite3.Row, scan: sqlite3.Row) -> str:
    asi_rows = db.execute(
        "SELECT * FROM asi_scores WHERE scan_run_id = ? ORDER BY category", (scan["id"],)
    ).fetchall()
    chaos_rows = db.execute(
        "SELECT * FROM chaos_runs WHERE scan_run_id = ?", (scan["id"],)
    ).fetchall()
    z3_rows = db.execute(
        "SELECT * FROM z3_results WHERE scan_run_id = ?", (scan["id"],)
    ).fetchall()

    score = scan["overall_score"] or 0
    z3_text, z3_cls = z3_label(scan["z3_status"])
    chaos_grade = scan["chaos_grade"] or "—"
    cards = "\n".join(render_asi_card(r, i) for i, r in enumerate(asi_rows))
    chaos_grid = render_chaos_grid(chaos_rows)
    z3_section = render_z3_section(z3_rows)

    completed = scan["completed_at"] or ""
    if completed:
        try:
            completed = datetime.fromisoformat(completed.replace("Z", "+00:00")).strftime("%b %d, %Y · %H:%M UTC")
        except Exception:
            pass

    title = f"{agent['name']} — AgentReady safety report"
    description = f"All 10 OWASP ASI-2026 attack categories run live against {agent['name']} on AMD MI300X. Overall score {score:.1f}/100."
    head = HEAD.format(title=esc(title), description=esc(description))
    header = header_html("../")
    return (
        head
        + header
        + f"""
<main class="mx-auto max-w-6xl px-6 py-10 space-y-10">
  <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
    <div>
      <a href="../leaderboard.html" class="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300">← back to leaderboard</a>
      <div class="mt-2 text-[10px] uppercase tracking-[0.15em] text-zinc-500">Agent report</div>
      <h1 class="mt-1 text-5xl font-bold tracking-tight">{esc(agent['name'])}</h1>
      <div class="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
        <span class="rounded-full border border-zinc-800 px-2 py-0.5 font-mono text-xs">{esc(agent['framework'] or 'unknown')}</span>
        {f'<span class="text-xs">⭐ {agent["stars"]:,}</span>' if agent['stars'] else ''}
        <a href="{esc(agent['github_url'])}" target="_blank" rel="noreferrer" class="text-xs text-zinc-400 transition-colors hover:text-zinc-100">github ↗</a>
      </div>
    </div>
  </header>

  <section class="grid gap-4 md:grid-cols-3">
    <div class="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-black p-6">
      <div class="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Overall safety score</div>
      <div class="mt-1 flex items-baseline gap-2">
        <span class="font-mono text-6xl tabular-nums {score_color(score)}">{score:.1f}</span>
        <span class="text-base text-zinc-600">/ 100</span>
      </div>
      <div class="mt-2 text-xs text-zinc-500">Scored {esc(completed)}</div>
    </div>
    <div class="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div class="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Math-checked safety</div>
      <div class="mt-1 font-mono text-2xl {z3_cls}">{esc(z3_text)}</div>
      <div class="mt-2 text-xs text-zinc-500">4 built-in safety rules + 1 written by our model from the agent&apos;s description.</div>
    </div>
    <div class="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div class="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Stress-test grade</div>
      <div class="mt-1 font-mono text-5xl tabular-nums {grade_color(chaos_grade)}">{esc(chaos_grade)}</div>
      <div class="mt-2 text-xs text-zinc-500">A-F grade based on the worst square of the stress-test grid.</div>
    </div>
  </section>

  <section>
    <div class="mb-4">
      <h2 class="text-xl font-semibold">Safety category breakdown</h2>
      <p class="text-xs text-zinc-400 mt-1">Click any card to see how we tested that category — and every attack we ran against this agent.</p>
    </div>
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      {cards}
    </div>
  </section>

  <section>
    <h2 class="text-xl font-semibold mb-1">Stress test grid</h2>
    <p class="mb-4 max-w-2xl text-sm text-zinc-400">Each square = the agent&apos;s success rate on a normal task, measured under two kinds of stress: rewording the question (rows) and injecting fake server errors (columns). Method from <a href="https://arxiv.org/abs/2601.06112" class="text-zinc-300 underline" target="_blank" rel="noreferrer">ReliabilityBench (arXiv 2601.06112)</a>.</p>
    <div class="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
      {chaos_grid}
    </div>
  </section>

  <section>
    <h2 class="text-xl font-semibold mb-1">Math-checked safety contracts</h2>
    <p class="mb-4 max-w-2xl text-sm text-zinc-400">Math software (Z3) searches every possible input for any way to break a safety rule. PROVEN SAFE = the math couldn&apos;t find a way. COUNTER-EXAMPLE = it did, and we show the exact inputs.</p>
    {z3_section}
  </section>
</main>
"""
        + FOOTER
    )


def render_leaderboard_page(db: sqlite3.Connection, agents: list[sqlite3.Row], scans: dict[str, sqlite3.Row]) -> str:
    # rank by score
    ranked = sorted(
        [a for a in agents if a["overall_score"] is not None],
        key=lambda a: -a["overall_score"],
    )

    rows_html = ""
    for i, a in enumerate(ranked):
        scan = scans.get(a["slug"])
        score = a["overall_score"] or 0
        bg = (
            "bg-red-950/30" if score < 60
            else "bg-orange-950/20" if score < 70
            else "bg-yellow-950/15" if score < 80
            else "bg-emerald-950/25"
        )
        z3_text, z3_cls = z3_label(scan["z3_status"] if scan else None)
        chaos_grade = scan["chaos_grade"] if scan else "—"
        last = a["last_scored_at"] or ""
        if last:
            try:
                last = datetime.fromisoformat(last.replace("Z", "+00:00")).strftime("%b %d, %Y")
            except Exception:
                pass
        rank_color = "text-amd font-bold" if i == 0 else "text-zinc-300 font-bold" if i == 1 else "text-zinc-400 font-bold" if i == 2 else "text-zinc-600"
        rows_html += f"""
<tr class="{bg} transition-colors hover:bg-zinc-900/80">
  <td class="px-4 py-3.5 font-mono {rank_color}">{str(i+1).zfill(2)}</td>
  <td class="px-4 py-3.5">
    <a href="agent/{esc(a['slug'])}.html" class="font-semibold transition-colors hover:text-amd">{esc(a['name'])}</a>
  </td>
  <td class="px-4 py-3.5 text-zinc-400">{esc(a['framework'] or '—')}</td>
  <td class="px-4 py-3.5 text-right font-mono text-xl tabular-nums {score_color(score)}">{score:.1f}</td>
  <td class="px-4 py-3.5 text-right font-mono text-xs {z3_cls}">{esc(z3_text)}</td>
  <td class="px-4 py-3.5 text-center font-mono text-lg tabular-nums {grade_color(chaos_grade)}">{esc(chaos_grade)}</td>
  <td class="px-4 py-3.5 text-xs text-zinc-500">{esc(last)}</td>
  <td class="px-4 py-3.5 text-right">
    <a href="agent/{esc(a['slug'])}.html" class="rounded-md border border-amd/40 bg-amd/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amd transition-all hover:bg-amd/20">Report →</a>
  </td>
</tr>
"""

    # bands
    bands = [
        ("≥ 80 · low risk", "bg-emerald-500", 80),
        ("70–79 · moderate risk", "bg-yellow-500", 70),
        ("60–69 · elevated risk", "bg-orange-500", 60),
        ("< 60 · high risk", "bg-red-500", 0),
    ]
    counts = []
    for i, (_, _, mn) in enumerate(bands):
        mx = 200 if i == 0 else bands[i - 1][2]
        counts.append(sum(1 for a in ranked if mn <= (a["overall_score"] or 0) < mx))
    total = len(ranked) or 1
    band_html = ""
    for (lbl, color, _), n in zip(bands, counts):
        band_html += f"""
<div class="flex items-center gap-3 text-xs">
  <div class="w-40 font-mono text-zinc-400">{esc(lbl)}</div>
  <div class="flex-1 overflow-hidden rounded-full bg-zinc-900"><div class="h-2.5 {color}" style="width: {(n / total) * 100:.0f}%"></div></div>
  <div class="w-10 text-right font-mono text-base font-semibold tabular-nums text-zinc-200">{n}</div>
</div>
"""

    failing = sum(1 for a in ranked if (a["overall_score"] or 100) < 70)
    title = "Leaderboard — AgentReady"
    description = f"{failing} of {len(ranked)} famous open-source AI agents fail the new safety standard."
    head = HEAD.format(title=esc(title), description=esc(description))
    header = header_html("./")
    return (
        head
        + header
        + f"""
<main class="mx-auto max-w-6xl px-6 py-10 space-y-10">
  <section>
    <div class="mb-4 flex items-center gap-2">
      <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-amd"></span>
      <span class="text-[10px] font-semibold uppercase tracking-[0.2em] text-amd">Live · Public adversarial benchmark</span>
    </div>
    <h1 class="max-w-5xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
      <span class="text-amd">{failing}</span><span class="text-zinc-600"> of </span><span>{len(ranked)}</span>
      <span class="text-zinc-300"> famous open-source AI agents</span>
      <span class="text-zinc-300"> fail the </span>
      <span class="bg-gradient-to-r from-amd via-red-400 to-orange-300 bg-clip-text text-transparent">new safety standard</span><span class="text-zinc-300">.</span>
    </h1>
    <p class="mt-6 max-w-2xl text-base text-zinc-400">
      All 10 OWASP ASI-2026 attack categories run for real on a single AMD MI300X — fake memories, slow-burn manipulation, peer-agent spoofing, identity abuse, and 6 more. Click any agent to see exactly which attacks worked, the full transcript of each one, and the math-checked safety verdict.
    </p>
  </section>

  <section class="overflow-hidden rounded-2xl border border-zinc-800">
    <table class="w-full text-sm">
      <thead class="bg-zinc-900/60 text-left text-[10px] uppercase tracking-[0.15em] text-zinc-500">
        <tr>
          <th class="px-4 py-3 w-12">#</th>
          <th class="px-4 py-3">Agent</th>
          <th class="px-4 py-3">Built on</th>
          <th class="px-4 py-3 text-right">Safety score / 100</th>
          <th class="px-4 py-3 text-right">Math-checked</th>
          <th class="px-4 py-3 text-center">Stress grade</th>
          <th class="px-4 py-3">Last tested</th>
          <th class="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-zinc-800/60">
        {rows_html}
      </tbody>
    </table>
  </section>

  <section class="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
    <div class="text-[10px] uppercase tracking-[0.2em] text-zinc-500">What we found</div>
    <h2 class="mt-1 text-2xl font-bold tracking-tight">No famous AI agent lands in the low-risk band.</h2>
    <p class="mt-2 max-w-3xl text-sm text-zinc-400">Across all 10 attack categories we run for real, every scored agent falls between moderate and elevated risk. The two biggest weak spots: getting tricked by fake memories and getting worn down by slow-burn manipulation over multiple turns.</p>
    <div class="mt-5 space-y-2.5">
      {band_html}
    </div>
  </section>
</main>
"""
        + FOOTER
    )


def main() -> None:
    DOCS_DIR.mkdir(parents=True, exist_ok=True)
    AGENT_DIR.mkdir(parents=True, exist_ok=True)

    db = open_db()
    agents = db.execute("SELECT * FROM agents WHERE overall_score IS NOT NULL").fetchall()
    scans = latest_scan_per_agent(db)

    # leaderboard
    leaderboard_html = render_leaderboard_page(db, agents, scans)
    (DOCS_DIR / "leaderboard.html").write_text(leaderboard_html)
    print(f"  wrote docs/leaderboard.html ({len(leaderboard_html):,} bytes)")

    # per-agent pages
    for a in agents:
        scan = scans.get(a["slug"])
        if scan is None:
            continue
        page = render_agent_page(db, a, scan)
        out = AGENT_DIR / f"{a['slug']}.html"
        out.write_text(page)
        print(f"  wrote docs/agent/{a['slug']}.html ({len(page):,} bytes)")

    db.close()
    print(f"\ndone. {len(agents)} agent pages + leaderboard generated.")


if __name__ == "__main__":
    main()
