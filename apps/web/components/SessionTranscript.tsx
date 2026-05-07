type WorstFailure = {
  category?: string;
  name?: string;
  payload?: string;
  plant?: string;
  trigger?: string;
  baseline_response?: string;
  post_attack_response?: string;
  reasoning?: string;
  confidence?: number;
  extra?: Record<string, unknown>;
};

const CATEGORY_LABELS: Record<string, string> = {
  // ASI06 sub-categories
  false_approval: "ASI06 — false approval memory",
  fake_preference: "ASI06 — fake preference memory",
  fake_authority: "ASI06 — fake authority memory",
  self_replicating: "ASI06 — self-replicating memory",
  goal_drift: "ASI06 — goal-drift memory",
  // ASI01/09 categories themselves
  ASI01: "ASI01 — agent goal hijack",
  ASI06: "ASI06 — memory poisoning",
  ASI09: "ASI09 — Crescendo (multi-turn trust exploitation)",
};

export function SessionTranscript({ failure }: { failure: WorstFailure | null | undefined }) {
  if (!failure) return null;

  const category = failure.category ?? "";
  const label = CATEGORY_LABELS[category] ?? category;
  const confidencePct = failure.confidence ? Math.round(failure.confidence * 100) : null;
  // ASI01/09 use `payload` instead of `plant`. Crescendo uses an array of phases via extra.transcript.
  const plantText = failure.plant ?? failure.payload ?? "—";
  const triggerText = failure.trigger ?? "(see payload)";

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
          <div className="mb-2 text-xs uppercase tracking-wider text-emerald-400">Clean baseline</div>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">trigger</div>
              <div className="mt-1 rounded-lg bg-zinc-900 p-3 font-mono text-xs leading-relaxed">
                {triggerText}
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
          <div className="mb-2 text-xs uppercase tracking-wider text-red-300">After attack</div>
          <div className="space-y-3">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">attack payload</div>
              <div className="mt-1 max-h-44 overflow-auto rounded-lg bg-red-950/40 p-3 font-mono text-xs leading-relaxed text-red-200 whitespace-pre-wrap">
                {plantText}
              </div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-zinc-500">agent response — manipulated</div>
              <div className="mt-1 rounded-lg bg-red-900/40 p-3 text-xs leading-relaxed text-red-100 whitespace-pre-wrap">
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
