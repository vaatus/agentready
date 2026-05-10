"use client";

import { useState } from "react";

import type { AsiScore } from "@/lib/api";
import { ASIExplainerModal } from "./ASIExplainerModal";

const CATEGORY_NAMES: Record<string, string> = {
  ASI01: "Hijacking the agent",
  ASI02: "Combining safe tools, harmful outcome",
  ASI03: "Pretending to be someone else",
  ASI04: "Sneaky tools in the toolbox",
  ASI05: "Running attacker code",
  ASI06: "Planting fake memories",
  ASI07: "Knocking the agent off-track",
  ASI08: "Tricking another agent",
  ASI09: "Slow-burn manipulation",
  ASI10: "Drift over long runs",
};

function color(score: number) {
  if (score < 60) return "from-red-500 to-red-700";
  if (score < 70) return "from-orange-500 to-orange-700";
  if (score < 80) return "from-yellow-400 to-yellow-600";
  return "from-emerald-400 to-emerald-600";
}

export function ASIScorecard({ scores }: { scores: AsiScore[] }) {
  const [active, setActive] = useState<AsiScore | null>(null);

  return (
    <>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {scores.map((s) => (
          <button
            key={s.category}
            onClick={() => setActive(s)}
            className={`group rounded-xl border p-4 text-left transition-all ${
              s.is_real
                ? "border-amd/30 bg-zinc-950 hover:border-amd hover:bg-zinc-900"
                : "border-zinc-800 bg-zinc-950 hover:border-zinc-600 hover:bg-zinc-900"
            }`}
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                    {s.category}
                  </div>
                  {s.is_real ? (
                    <span
                      className="rounded-full bg-amd/20 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amd"
                      title="We ran real attacks against this agent"
                    >
                      tested
                    </span>
                  ) : (
                    <span
                      className="rounded-full bg-zinc-800 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-400"
                      title="Score estimated from the agent's blueprint, not from real attacks"
                    >
                      estimated
                    </span>
                  )}
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
            <div className="mt-2 flex items-center justify-between gap-2 text-xs">
              {s.is_real ? (
                <span className="text-zinc-400">
                  <span className="font-mono text-amd">{s.failed_attacks_count}</span>
                  <span className="text-zinc-500">
                    {" "}
                    / {s.failed_attacks_count + s.passed_attacks_count} attacks worked
                  </span>
                </span>
              ) : (
                <span className="italic text-zinc-500">estimated from blueprint</span>
              )}
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 group-hover:text-amd">
                see how we test →
              </span>
            </div>
          </button>
        ))}
      </div>

      <ASIExplainerModal open={active !== null} onClose={() => setActive(null)} score={active} />
    </>
  );
}
