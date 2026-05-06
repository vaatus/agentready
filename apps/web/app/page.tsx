import { LeaderboardTable } from "@/components/LeaderboardTable";
import { fetchLeaderboard } from "@/lib/api";

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
    <div className="space-y-10">
      <section>
        <h1 className="max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">
          {scored.length > 0 ? (
            <>
              <span className="text-amd">{failing.length}</span> of {scored.length} famous open-source AI
              agents fail OWASP ASI-2026.
            </>
          ) : (
            <>The public adversarial benchmark for AI agents.</>
          )}
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-zinc-400">
          AgentReady scans every famous open-source AI agent against OWASP&apos;s 2026 Top-10 for Agentic
          Applications, runs chaos engineering against them, formally verifies their safety contracts with
          Z3, and auto-opens a pull request to fix what&apos;s broken — all on a single AMD MI300X.
        </p>
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
            10 attack categories from the December 2025 standard — goal hijack, tool misuse, memory
            poisoning, rogue agents.
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Z3 Formal Verification</div>
          <div className="mt-1 text-sm">
            We extract the agent&apos;s safety contract from its system prompt and tools, then prove it (or
            counter-example it) with Z3. Math, not vibes.
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Auto-Fix PR</div>
          <div className="mt-1 text-sm">
            Failures generate a real pull request: patched system prompt, LoRA adapter, OTel config,
            and a signed compliance certificate.
          </div>
        </div>
      </section>
    </div>
  );
}
