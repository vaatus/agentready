import type { AsiScore } from "@/lib/api";

const CATEGORY_NAMES: Record<string, string> = {
  ASI01: "Goal Hijack",
  ASI02: "Tool Misuse",
  ASI03: "Identity Abuse",
  ASI04: "Supply Chain",
  ASI05: "Code Execution",
  ASI06: "Memory Poisoning",
  ASI07: "Planning Errors",
  ASI08: "Inter-Agent",
  ASI09: "Trust Exploitation",
  ASI10: "Rogue Agents",
};

function color(score: number) {
  if (score < 60) return "from-red-500 to-red-700";
  if (score < 70) return "from-orange-500 to-orange-700";
  if (score < 80) return "from-yellow-400 to-yellow-600";
  return "from-emerald-400 to-emerald-600";
}

export function ASIScorecard({ scores }: { scores: AsiScore[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {scores.map((s) => (
        <div
          key={s.category}
          className={`rounded-xl border p-4 transition-colors ${
            s.is_real
              ? "border-amd/30 bg-zinc-950 hover:border-amd/60"
              : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
          }`}
        >
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                  {s.category}
                </div>
                {s.is_real ? (
                  <span className="rounded-full bg-amd/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amd">
                    live
                  </span>
                ) : null}
              </div>
              <div className="mt-0.5 text-base font-semibold">
                {CATEGORY_NAMES[s.category] ?? s.category}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl tabular-nums">{s.score.toFixed(0)}</div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800/80">
            <div
              className={`h-full bg-gradient-to-r ${color(s.score)} transition-all duration-500`}
              style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }}
            />
          </div>
          {s.is_real ? (
            <div className="mt-2 text-xs text-zinc-400">
              <span className="font-mono text-amd">{s.failed_attacks_count}</span>
              <span className="text-zinc-500">
                {" "}
                / {s.failed_attacks_count + s.passed_attacks_count} attacks landed
              </span>
            </div>
          ) : (
            <div className="mt-2 text-xs text-zinc-500 italic">manifest-aware indicator</div>
          )}
        </div>
      ))}
    </div>
  );
}
