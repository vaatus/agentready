import { notFound } from "next/navigation";

import { ASIScorecard } from "@/components/ASIScorecard";
import { ReliabilitySurface } from "@/components/ReliabilitySurface";
import { RemediationPanel } from "@/components/RemediationPanel";
import { SessionTranscript } from "@/components/SessionTranscript";
import { fetchAgent } from "@/lib/api";

export const revalidate = 60;

export default async function AgentPage({ params }: { params: { slug: string } }) {
  let agent: Awaited<ReturnType<typeof fetchAgent>>;
  try {
    agent = await fetchAgent(params.slug);
  } catch {
    notFound();
  }

  const score = agent.overall_score;

  return (
    <div className="space-y-8">
      <header>
        <div className="text-xs uppercase tracking-wider text-zinc-500">Agent report</div>
        <h1 className="mt-1 text-4xl font-semibold">{agent.name}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm text-zinc-400">
          <span>{agent.framework}</span>
          {agent.stars > 0 ? <span>· ⭐ {agent.stars.toLocaleString()}</span> : null}
          <span>·</span>
          <a href={agent.github_url} target="_blank" rel="noreferrer" className="hover:text-zinc-200">
            github ↗
          </a>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Overall</div>
          <div className="mt-2 font-mono text-5xl">
            {score !== null ? score.toFixed(1) : "—"}
            <span className="ml-1 text-base text-zinc-500">/100</span>
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            {agent.last_scored_at
              ? `Last scored ${new Date(agent.last_scored_at).toLocaleString()}`
              : "Awaiting first scan"}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Z3 verification</div>
          <div className="mt-2 font-mono text-2xl">
            {agent.latest_scan?.z3_status ?? "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Hand-written contract templates against declared tools.
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Chaos resilience</div>
          <div className="mt-2 font-mono text-2xl">
            {agent.latest_scan?.chaos_grade ?? "—"}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            Reliability Surface R(k, ε, λ) under fault injection.
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-semibold">OWASP ASI-2026 breakdown</h2>
        <ASIScorecard scores={agent.asi_scores} />
      </section>

      {(agent.chaos_cells ?? []).length > 0 ? (
        <section>
          <h2 className="mb-1 text-xl font-semibold">Reliability Surface R(k=1, ε, λ)</h2>
          <p className="mb-4 max-w-2xl text-sm text-zinc-400">
            How pass@1 degrades under input perturbation rate ε and fault injection rate λ.
            Chaos engineering for AI agents — same methodology as Netflix Chaos Monkey,
            but applied to LLM-driven workflows.
          </p>
          <ReliabilitySurface cells={agent.chaos_cells} />
        </section>
      ) : null}

      <RemediationPanel slug={agent.slug} />

      <SessionTranscript failure={agent.worst_failure as Parameters<typeof SessionTranscript>[0]["failure"]} />
    </div>
  );
}
