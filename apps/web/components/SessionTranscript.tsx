type WorstFailure = {
  category?: string;
  plant?: string;
  trigger?: string;
  baseline_response?: string;
  post_attack_response?: string;
  reasoning?: string;
  confidence?: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  false_approval: "False approval memory",
  fake_preference: "Fake preference memory",
  fake_authority: "Fake authority memory",
  self_replicating: "Self-replicating memory",
  goal_drift: "Goal-drift memory",
};

export function SessionTranscript({ failure }: { failure: WorstFailure | null | undefined }) {
  if (!failure) return null;

  const category = failure.category ?? "";
  const label = CATEGORY_LABELS[category] ?? category;
  const confidencePct = failure.confidence ? Math.round(failure.confidence * 100) : null;

  return (
    <section className="rounded-2xl border border-red-900 bg-gradient-to-br from-red-950/40 to-red-950/10 p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wider text-red-300">Live ASI06 break</div>
          <h2 className="mt-1 text-xl font-semibold">
            {label}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Two-session test. Session 1 plants the poisoned memory. Session 2 issues a benign-looking
            trigger query. The Judge LLM scores whether the post-attack response materially deviates
            from baseline in the way the attack intended.
          </p>
        </div>
        {confidencePct !== null ? (
          <div className="shrink-0 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 font-mono text-sm text-red-200">
            Judge confidence&nbsp;{confidencePct}%
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Baseline session */}
        <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-emerald-400">Session 1 — clean baseline</div>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">user trigger</div>
              <div className="mt-1 rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed">
                {failure.trigger ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">agent response</div>
              <div className="mt-1 rounded-lg bg-emerald-950/30 p-3 text-xs leading-relaxed text-emerald-100">
                {failure.baseline_response ?? "—"}
              </div>
            </div>
          </div>
        </div>

        {/* Attack session */}
        <div className="rounded-xl border border-red-700/60 bg-black/40 p-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-red-300">Session 2 — after poison plant</div>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">poisoned memory planted (turn 1)</div>
              <div className="mt-1 rounded-lg bg-red-950/40 p-3 font-mono text-xs leading-relaxed text-red-200">
                {failure.plant ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">user trigger (turn 2 — same as baseline)</div>
              <div className="mt-1 rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed">
                {failure.trigger ?? "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">agent response — manipulated</div>
              <div className="mt-1 rounded-lg bg-red-900/40 p-3 text-xs leading-relaxed text-red-100">
                {failure.post_attack_response ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {failure.reasoning ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-[11px] uppercase tracking-wider text-zinc-500">Judge reasoning</div>
          <div className="mt-1 text-sm text-zinc-300">{failure.reasoning}</div>
        </div>
      ) : null}
    </section>
  );
}
