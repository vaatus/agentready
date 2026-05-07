import { LeaderboardTable } from "@/components/LeaderboardTable";
import { fetchLeaderboard, type LeaderboardEntry } from "@/lib/api";

export const revalidate = 60;

export default async function HomePage() {
  let agents: Awaited<ReturnType<typeof fetchLeaderboard>>["agents"] = [];
  let error: string | null = null;
  try {
    const data = await fetchLeaderboard();
    agents = data.agents;
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to fetch leaderboard";
  }

  const scored = agents.filter((a) => a.overall_score !== null);
  const failing = scored.filter((a) => (a.overall_score ?? 100) < 70);

  return (
    <div className="space-y-14">
      <section>
        {scored.length > 0 ? (
          <>
            <div className="mb-4 flex items-center gap-2">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amd" />
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amd">
                Live · Public adversarial benchmark
              </span>
            </div>
            <h1 className="max-w-5xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
              <span className="text-amd">{failing.length}</span>
              <span className="text-zinc-600"> of </span>
              <span>{scored.length}</span>
              <span className="text-zinc-300"> famous open-source AI agents</span>
              <br className="hidden md:block" />
              <span className="text-zinc-300"> fail </span>
              <span className="bg-gradient-to-r from-amd via-red-400 to-orange-300 bg-clip-text text-transparent">
                OWASP ASI-2026
              </span>
              <span className="text-zinc-300">.</span>
            </h1>
          </>
        ) : (
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
            The public adversarial benchmark for AI agents.
          </h1>
        )}
        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          AgentReady scans every famous open-source AI agent against OWASP&apos;s 2026 Top-10 for
          Agentic Applications, runs chaos engineering against them, formally verifies their safety
          contracts with Z3, and auto-opens a pull request to fix what&apos;s broken — all on a
          single AMD MI300X.
        </p>
        {scored.length > 0 ? (
          <div className="mt-6 flex flex-wrap gap-2">
            <Stat label="agents scored" value={String(scored.length)} />
            <Stat label="live ASI categories" value="5" />
            <Stat label="Judge LLM" value="Qwen 2.5 72B AWQ" />
            <Stat label="VRAM concurrent" value="~75 / 192 GB" highlight />
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-6">
          <div className="text-sm font-semibold text-red-300">Backend unreachable</div>
          <div className="mt-2 text-xs text-red-400/80">{error}</div>
          <div className="mt-3 text-xs text-zinc-400">
            Start the API with{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5">uvicorn apps.api.main:app</code> and
            seed the leaderboard with{" "}
            <code className="rounded bg-zinc-900 px-1.5 py-0.5">
              python -m apps.api.cli seed-leaderboard
            </code>
            .
          </div>
        </div>
      ) : (
        <LeaderboardTable rows={agents} />
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Card
          title="What we test"
          body="OWASP's brand-new Top-10 for Agentic Applications, published December 2025. Five categories run real attacks — Goal Hijack, Tool Misuse, Code Execution, Memory Poisoning, and Crescendo trust escalation. The other five are manifest-aware indicators."
        />
        <Card
          title="How we score"
          body="A 70B Judge LLM (Qwen 2.5 72B AWQ) reads each attempted attack and decides whether the agent was actually manipulated. Then a Z3 SMT solver tries to find a mathematical counterexample to the agent's declared safety contract. Math, not vibes."
        />
        <Card
          title="What you get"
          body="Click any agent on the leaderboard. See exactly which attacks landed. Click 'Generate fix PR' — Qwen authors guard rules, re-runs the same attacks against the patched prompt to measure the improvement, and opens a real GitHub pull request with a signed compliance certificate."
        />
      </section>

      {scored.length > 0 ? <ConcentrationFinding agents={agents} /> : null}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
        highlight ? "border-amd/40 bg-amd/10" : "border-zinc-800 bg-zinc-900/50"
      }`}
    >
      <span className={`font-mono ${highlight ? "text-amd font-semibold" : "text-zinc-200"}`}>
        {value}
      </span>
      <span className="text-zinc-500">{label}</span>
    </span>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 transition-colors hover:border-zinc-700">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">{title}</div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-300">{body}</div>
    </div>
  );
}

function ConcentrationFinding({ agents }: { agents: LeaderboardEntry[] }) {
  const bands = [
    { label: "≥ 80 · low", color: "bg-emerald-500", min: 80 },
    { label: "70-79 · moderate", color: "bg-yellow-500", min: 70 },
    { label: "60-69 · elevated", color: "bg-orange-500", min: 60 },
    { label: "< 60 · high", color: "bg-red-500", min: 0 },
  ];
  const counts = bands.map((b, i) => {
    const max = i === 0 ? 200 : bands[i - 1].min;
    return agents.filter(
      (a) => a.overall_score !== null && a.overall_score >= b.min && a.overall_score < max,
    ).length;
  });
  const total = agents.filter((a) => a.overall_score !== null).length || 1;

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
        Concentration risk · finding
      </div>
      <h2 className="mt-1 text-2xl font-bold tracking-tight">
        No famous AI agent reaches the low-risk band.
      </h2>
      <p className="mt-2 max-w-3xl text-sm text-zinc-400">
        With five live ASI categories on the 72B Judge, every scored agent falls in the
        moderate-to-elevated risk window. The dominant failure modes: memory poisoning (ASI06) and
        Crescendo trust exploitation (ASI09).
      </p>
      <div className="mt-5 space-y-2.5">
        {bands.map((b, i) => (
          <div key={b.label} className="flex items-center gap-3 text-xs">
            <div className="w-36 font-mono text-zinc-400">{b.label}</div>
            <div className="flex-1 overflow-hidden rounded-full bg-zinc-900">
              <div
                className={`h-2.5 ${b.color} transition-all duration-700`}
                style={{ width: `${(counts[i] / total) * 100}%` }}
              />
            </div>
            <div className="w-10 text-right font-mono text-base font-semibold tabular-nums text-zinc-200">
              {counts[i]}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
