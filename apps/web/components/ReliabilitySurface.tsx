import { Fragment } from "react";

import type { ChaosCell } from "@/lib/api";

function color(p: number): string {
  // Pass-rate to colour: 1.0 emerald → 0.5 yellow → 0.0 red.
  if (p >= 0.85) return "bg-emerald-600";
  if (p >= 0.70) return "bg-emerald-500/80";
  if (p >= 0.55) return "bg-yellow-500/80";
  if (p >= 0.40) return "bg-orange-500/80";
  return "bg-red-600";
}

export function ReliabilitySurface({ cells }: { cells: ChaosCell[] }) {
  if (cells.length === 0) {
    return (
      <div className="text-xs text-zinc-500">No chaos cells yet — run a scan.</div>
    );
  }
  // We expect a 3x3 grid (3 ε × 3 λ). Bucket by ε then λ.
  const epsilons = Array.from(new Set(cells.map((c) => c.epsilon))).sort((a, b) => a - b);
  const lambdas = Array.from(new Set(cells.map((c) => c.lambda_))).sort((a, b) => a - b);

  function cellAt(eps: number, lam: number): ChaosCell | undefined {
    return cells.find((c) => c.epsilon === eps && c.lambda_ === lam);
  }

  return (
    <div className="space-y-2">
      <div className="grid auto-rows-min" style={{ gridTemplateColumns: `5rem repeat(${lambdas.length}, minmax(0, 1fr))` }}>
        <div></div>
        {lambdas.map((lam) => (
          <div key={`hdr-${lam}`} className="px-1 pb-1 text-center font-mono text-[11px] text-zinc-500">
            λ = {lam.toFixed(1)}
          </div>
        ))}
        {epsilons.map((eps) => (
          <Fragment key={`row-${eps}`}>
            <div className="flex items-center justify-end pr-2 font-mono text-[11px] text-zinc-500">
              ε = {eps.toFixed(1)}
            </div>
            {lambdas.map((lam) => {
              const c = cellAt(eps, lam);
              const p = c?.pass_at_1 ?? 0;
              const live = c?.is_real ?? false;
              return (
                <div
                  key={`cell-${eps}-${lam}`}
                  className={`relative m-0.5 flex h-12 items-center justify-center rounded ${color(p)} ${live ? "ring-1 ring-amd" : ""}`}
                  title={`pass@1 = ${p.toFixed(2)} (n=${c?.n_trials ?? 0}, ${live ? "live" : "computed"})`}
                >
                  <span className="font-mono text-xs font-semibold text-white">{p.toFixed(2)}</span>
                  {live ? (
                    <span className="absolute right-0.5 top-0.5 rounded bg-amd px-1 text-[8px] uppercase tracking-wider text-white">
                      live
                    </span>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="text-[10px] text-zinc-500">
        Pass@1 across input perturbation rate ε and fault injection rate λ.
        From <a href="https://arxiv.org/abs/2601.06112" className="text-zinc-400 underline" target="_blank" rel="noreferrer">ReliabilityBench (arXiv 2601.06112)</a>.
      </div>
    </div>
  );
}
