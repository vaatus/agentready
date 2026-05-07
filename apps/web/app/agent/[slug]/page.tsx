import Link from "next/link";
import { notFound } from "next/navigation";

import { ASIScorecard } from "@/components/ASIScorecard";
import { ReliabilitySurface } from "@/components/ReliabilitySurface";
import { RemediationPanel } from "@/components/RemediationPanel";
import { SessionTranscript } from "@/components/SessionTranscript";
import { fetchAgent } from "@/lib/api";

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
          <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
            Z3 verification
          </div>
          <div className={`mt-1 font-mono text-2xl ${z3Color(z3)}`}>{z3 ?? "—"}</div>
          <div className="mt-2 text-xs text-zinc-500">
            Hand-written contracts + Qwen-authored auto-formalization.
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">
            Chaos resilience
          </div>
          <div className={`mt-1 font-mono text-5xl tabular-nums ${gradeColor(chaosGrade)}`}>
            {chaosGrade ?? "—"}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            R(k=1, ε, λ) — pass@1 under perturbation + fault injection.
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">OWASP ASI-2026 breakdown</h2>
          <div className="text-xs text-zinc-500">
            <span className="rounded bg-amd/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amd">
              live
            </span>
            <span className="ml-2">= attacks executed against the substitute on MI300X</span>
          </div>
        </div>
        <ASIScorecard scores={agent.asi_scores} />
      </section>

      {(agent.chaos_cells ?? []).length > 0 ? (
        <section>
          <h2 className="mb-1 text-xl font-semibold">Reliability Surface R(k=1, ε, λ)</h2>
          <p className="mb-4 max-w-2xl text-sm text-zinc-400">
            How pass@1 degrades under input perturbation rate ε and fault injection rate λ.
            Chaos engineering for AI agents — same methodology as Netflix Chaos Monkey, applied to
            LLM-driven workflows.
          </p>
          <ReliabilitySurface slug={agent.slug} cells={agent.chaos_cells} />
        </section>
      ) : null}

      <RemediationPanel slug={agent.slug} />

      <SessionTranscript
        failure={agent.worst_failure as Parameters<typeof SessionTranscript>[0]["failure"]}
      />
    </div>
  );
}
