import Link from "next/link";
import { notFound } from "next/navigation";

import { ASIScorecard } from "@/components/ASIScorecard";
import { InfoTooltip } from "@/components/InfoTooltip";
import { ReliabilitySurface } from "@/components/ReliabilitySurface";
import { RemediationPanel } from "@/components/RemediationPanel";
import { SessionTranscript } from "@/components/SessionTranscript";
import { fetchAgent, type AttackRecord } from "@/lib/api";

export const revalidate = 60;

function scoreColor(score: number | null): string {
  if (score === null) return "text-zinc-500";
  if (score < 60) return "text-red-400";
  if (score < 70) return "text-orange-400";
  if (score < 80) return "text-yellow-400";
  return "text-emerald-400";
}

function z3Color(status: string | null | undefined): string {
  if (status === "VERIFIED") return "text-emerald-400";
  if (status === "VIOLATION") return "text-red-400";
  return "text-zinc-500";
}

function gradeColor(grade: string | null | undefined): string {
  if (grade === "A") return "text-emerald-400";
  if (grade === "B") return "text-yellow-400";
  if (grade === "C") return "text-orange-400";
  if (grade === "D" || grade === "F") return "text-red-400";
  return "text-zinc-500";
}

export default async function AgentPage({ params }: { params: { slug: string } }) {
  let agent: Awaited<ReturnType<typeof fetchAgent>>;
  try {
    agent = await fetchAgent(params.slug);
  } catch {
    notFound();
  }

  const score = agent.overall_score;
  const z3 = agent.latest_scan?.z3_status ?? null;
  const chaosGrade = agent.latest_scan?.chaos_grade ?? null;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            ← back to leaderboard
          </Link>
          <div className="mt-2 text-[10px] uppercase tracking-[0.15em] text-zinc-500">
            Agent report
          </div>
          <h1 className="mt-1 text-5xl font-bold tracking-tight">{agent.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-zinc-400">
            <span className="rounded-full border border-zinc-800 px-2 py-0.5 font-mono text-xs">
              {agent.framework}
            </span>
            {agent.stars > 0 ? (
              <span className="text-xs">⭐ {agent.stars.toLocaleString()}</span>
            ) : null}
            <a
              href={agent.github_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-zinc-400 transition-colors hover:text-zinc-100"
            >
              github ↗
            </a>
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 to-black p-6">
          <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">Overall</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`font-mono text-6xl tabular-nums ${scoreColor(score)}`}>
              {score !== null ? score.toFixed(1) : "—"}
            </span>
            <span className="text-base text-zinc-600">/ 100</span>
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            {agent.last_scored_at
              ? `Scored ${new Date(agent.last_scored_at).toLocaleString()}`
              : "Awaiting first scan"}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center text-[10px] uppercase tracking-[0.15em] text-zinc-500">
            Z3 verification
            <InfoTooltip label="Z3 verification">
              Math, not vibes. Z3 SMT solver tries to find an input that violates the agent&apos;s
              declared safety contract. <span className="text-emerald-300">VERIFIED</span> = the
              math says it&apos;s safe. <span className="text-red-300">VIOLATION</span> = a
              concrete counterexample exists.
            </InfoTooltip>
          </div>
          <div className={`mt-1 font-mono text-2xl ${z3Color(z3)}`}>{z3 ?? "—"}</div>
          <div className="mt-2 text-xs text-zinc-500">
            4 hand-written templates + 1 Qwen-authored auto-contract.
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="flex items-center text-[10px] uppercase tracking-[0.15em] text-zinc-500">
            Chaos resilience
            <InfoTooltip label="Chaos grade">
              Grade A-F derived from the worst pass@1 cell across the Reliability Surface. A means
              the agent shrugs off perturbation and rate-limits; F means it falls over. Like a
              Netflix Chaos Monkey grade for AI agents.
            </InfoTooltip>
          </div>
          <div className={`mt-1 font-mono text-5xl tabular-nums ${gradeColor(chaosGrade)}`}>
            {chaosGrade ?? "—"}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            How the agent holds up under input perturbation + simulated rate-limits.
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">OWASP ASI-2026 breakdown</h2>
            <p className="text-xs text-zinc-400">
              Click any card to see what the category tests, the workflow that produced this score,
              and every attack that was tried against this agent.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span className="rounded bg-amd/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amd">
              live
            </span>
            <span>= real attacks ran on MI300X · </span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400">
              indicator
            </span>
            <span>= manifest-derived heuristic</span>
          </div>
        </div>
        <ASIScorecard scores={agent.asi_scores} />
      </section>

      {(agent.chaos_cells ?? []).length > 0 ? (
        <section>
          <div className="mb-1 flex items-center">
            <h2 className="text-xl font-semibold">Reliability Surface</h2>
            <InfoTooltip label="Reliability Surface">
              From ReliabilityBench (arXiv 2601.06112). 3×3 grid measuring pass@1 — the rate at
              which the agent succeeds on a benign task — across two stresses: input perturbation
              (ε) and fault injection (λ). Each cell is a real measurement with n trials.
            </InfoTooltip>
          </div>
          <p className="mb-4 max-w-2xl text-sm text-zinc-400">
            Read it like a heat map: the top-left cell is &ldquo;happy path&rdquo; (no chaos);
            bottom-right is the agent under maximum stress. Hover the ε / λ headers for definitions.
            Click <span className="font-mono text-amd">Run live chaos</span> to actually run the
            rate-limit fault on this agent right now.
          </p>
          <ReliabilitySurface slug={agent.slug} cells={agent.chaos_cells} />
        </section>
      ) : null}

      <RemediationPanel slug={agent.slug} />

      <SessionTranscript failure={agent.worst_failure as AttackRecord | null | undefined} />
    </div>
  );
}
