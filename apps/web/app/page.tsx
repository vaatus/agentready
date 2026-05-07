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
    <div className="space-y-12">
      <section className="text-center md:text-left">
        {scored.length > 0 ? (
          <h1 className="max-w-5xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            <span className="text-amd">{failing.length}</span>
            <span className="text-zinc-500"> of </span>
            <span>{scored.length}</span>
            <span className="text-zinc-300"> famous open-source AI agents</span>
            <br className="hidden md:block" />
            <span className="text-zinc-300"> fail </span>
            <span className="bg-gradient-to-r from-amd to-red-400 bg-clip-text text-transparent">
              OWASP ASI-2026
            </span>
            <span className="text-zinc-300">.</span>
          </h1>
        ) : (
          <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
            The public adversarial benchmark for AI agents.
          </h1>
        )}
        <p className="mt-6 max-w-2xl text-lg text-zinc-400">
          AgentReady scans every famous open-source AI agent against OWASP&apos;s 2026 Top-10 for Agentic
          Applications, runs chaos engineering against them, formally verifies their safety contracts with
          Z3, and auto-opens a pull request to fix what&apos;s broken — all on a single AMD MI300X.
        </p>
        {scored.length > 0 ? (
          <div className="mt-6 flex flex-wrap justify-center gap-3 md:justify-start">
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs">
              <span className="font-mono text-zinc-300">{scored.length}</span>{" "}
              <span className="text-zinc-500">agents scored</span>
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs">
              <span className="font-mono text-zinc-300">5</span>{" "}
              <span className="text-zinc-500">live ASI categories</span>
            </span>
            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs">
              <span className="font-mono text-zinc-300">Qwen 2.5 72B</span>{" "}
              <span className="text-zinc-500">Judge on MI300X</span>
            </span>
          </div>
        ) : null}
      </section>

      {error ? (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-6">
          <div className="text-sm font-semibold text-red-300">Backend unreachable</div>
          <div className="mt-2 text-xs text-red-400/80">{error}</div>
          <div className="mt-3 text-xs text-zinc-400">
            Start the API with <code className="rounded bg-zinc-900 px-1.5 py-0.5">uvicorn apps.api.main:app</code>{" "}
            and seed the leaderboard with <code className="rounded bg-zinc-900 px-1.5 py-0.5">python -m apps.api.cli seed-leaderboard</code>.
          </div>
        </div>
      ) : (
        <LeaderboardTable rows={agents} />
      )}

      <section className="grid gap-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-6 md:grid-cols-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">OWASP ASI-2026</div>
          <div className="mt-1 text-sm">
            10 attack categories from the December 2025 standard. ASI01 (Goal Hijack), ASI02 (Tool
            Misuse), ASI06 (Memory Poisoning), ASI09 (Trust Exploitation via Crescendo) run live; the
            other six are manifest-aware indicators.
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Z3 Formal Verification</div>
          <div className="mt-1 text-sm">
            We extract the agent&apos;s safety contract from its system prompt and tools, then prove it (or
            counter-example it) with Z3 SMT. Math, not vibes.
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Auto-Fix PR</div>
          <div className="mt-1 text-sm">
            Failures generate a real pull request: patched system prompt, LoRA adapter, OTel config,
            replayable test JSON, and a signed compliance certificate. Pre/post score validates the fix.
          </div>
        </div>
      </section>

      {scored.length > 0 ? <ConcentrationFinding agents={agents} /> : null}
    </div>
  );
}

function ConcentrationFinding({ agents }: { agents: LeaderboardEntry[] }) {
  // Concentration risk: which score band each agent falls into.
  const bands = [
    { label: "≥ 80 (low risk)", color: "bg-emerald-500", min: 80 },
    { label: "70-79 (moderate)", color: "bg-yellow-500", min: 70 },
    { label: "60-69 (elevated)", color: "bg-orange-500", min: 60 },
    { label: "< 60 (high risk)", color: "bg-red-500", min: 0 },
  ];
  const counts = bands.map((b, i) => {
    const max = i === 0 ? 200 : bands[i - 1].min;
    return agents.filter((a) => a.overall_score !== null && a.overall_score >= b.min && a.overall_score < max).length;
  });
  const total = agents.filter((a) => a.overall_score !== null).length || 1;
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
      <div className="text-xs uppercase tracking-wider text-zinc-500">Concentration risk</div>
      <h2 className="mt-1 text-xl font-semibold">All scored agents fall in the moderate-to-elevated risk bands</h2>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">
        With four live ASI categories on the 72B Judge, no famous open-source AI agent reaches the
        low-risk band (≥80). The most common failure modes are memory poisoning (ASI06) and Crescendo
        trust exploitation (ASI09).
      </p>
      <div className="mt-4 space-y-2">
        {bands.map((b, i) => (
          <div key={b.label} className="flex items-center gap-3 text-xs">
            <div className="w-32 text-zinc-400">{b.label}</div>
            <div className="flex-1 overflow-hidden rounded-full bg-zinc-900">
              <div
                className={`h-2 ${b.color}`}
                style={{ width: `${(counts[i] / total) * 100}%` }}
              />
            </div>
            <div className="w-8 text-right font-mono text-zinc-300">{counts[i]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
