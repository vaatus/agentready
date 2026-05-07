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
  false_approval: "ASI06 — false approval memory",
  fake_preference: "ASI06 — fake preference memory",
  fake_authority: "ASI06 — fake authority memory",
  self_replicating: "ASI06 — self-replicating memory",
  goal_drift: "ASI06 — goal-drift memory",
  ASI01: "ASI01 — agent goal hijack",
  ASI02: "ASI02 — tool misuse",
  ASI05: "ASI05 — code execution",
  ASI06: "ASI06 — memory poisoning",
  ASI06_NOVEL: "ASI06 — self-modifying memory (novel)",
  ASI09: "ASI09 — Crescendo (multi-turn trust)",
};

export function SessionTranscript({ failure }: { failure: WorstFailure | null | undefined }) {
  if (!failure) return null;

  const category = failure.category ?? "";
  const label = CATEGORY_LABELS[category] ?? category;
  const confidencePct = failure.confidence ? Math.round(failure.confidence * 100) : null;
  const plantText = failure.plant ?? failure.payload ?? "—";
  const triggerText = failure.trigger ?? "(see payload)";

  return (
    <section className="overflow-hidden rounded-2xl border border-red-900/60 bg-gradient-to-br from-red-950/30 via-red-950/10 to-transparent p-6 shadow-2xl shadow-red-950/20">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-300">
              live attack landed
            </span>
          </div>
          <h2 className="mt-2 text-2xl font-bold tracking-tight">{label}</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Two-session test. The agent received this attack and the Judge LLM (Qwen 2.5 72B AWQ on AMD
            MI300X) confirmed the manipulation succeeded.
          </p>
        </div>
        {confidencePct !== null ? (
          <div className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-center">
            <div className="font-mono text-3xl font-bold tabular-nums text-red-200">
              {confidencePct}%
            </div>
            <div className="mt-0.5 text-[10px] uppercase tracking-wider text-red-300">
              Judge confidence
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-900/50 bg-black/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-emerald-400">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
            clean baseline
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">trigger</div>
              <div className="mt-1 max-h-32 overflow-auto rounded-lg bg-zinc-900/80 p-3 font-mono text-xs leading-relaxed">
                {triggerText}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">agent response</div>
              <div className="mt-1 rounded-lg bg-emerald-950/40 p-3 text-xs leading-relaxed text-emerald-100">
                {failure.baseline_response ?? "—"}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-red-700/60 bg-black/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-300">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
            after attack
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">attack payload</div>
              <div className="mt-1 max-h-44 overflow-auto whitespace-pre-wrap rounded-lg bg-red-950/40 p-3 font-mono text-xs leading-relaxed text-red-200">
                {plantText}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                agent response — manipulated
              </div>
              <div className="mt-1 whitespace-pre-wrap rounded-lg bg-red-900/40 p-3 text-xs leading-relaxed text-red-100">
                {failure.post_attack_response ?? "—"}
              </div>
            </div>
          </div>
        </div>
      </div>

      {failure.reasoning ? (
        <div className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-[10px] uppercase tracking-wider text-zinc-500">
            Judge reasoning · Qwen 2.5 72B AWQ
          </div>
          <div className="mt-1.5 text-sm leading-relaxed text-zinc-300">{failure.reasoning}</div>
        </div>
      ) : null}
    </section>
  );
}
