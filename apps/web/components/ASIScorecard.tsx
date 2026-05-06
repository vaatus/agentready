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
  if (score < 40) return "from-red-500 to-red-700";
  if (score < 70) return "from-yellow-400 to-yellow-600";
  return "from-emerald-400 to-emerald-600";
}

export function ASIScorecard({ scores }: { scores: AsiScore[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {scores.map((s) => (
        <div
          key={s.category}
          className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-zinc-500">{s.category}</div>
              <div className="text-base font-semibold">{CATEGORY_NAMES[s.category] ?? s.category}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-2xl">{s.score.toFixed(0)}</div>
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                {s.is_real ? "live scan" : "indicator"}
              </div>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full bg-gradient-to-r ${color(s.score)}`}
              style={{ width: `${Math.max(0, Math.min(100, s.score))}%` }}
            />
          </div>
          {s.is_real ? (
            <div className="mt-2 text-xs text-zinc-400">
              {s.failed_attacks_count} of {s.failed_attacks_count + s.passed_attacks_count} attacks succeeded
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
