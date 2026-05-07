"use client";

import { Fragment, useState } from "react";

import { runLiveChaos, type ChaosCell } from "@/lib/api";
import { InfoTooltip } from "./InfoTooltip";

function color(p: number): string {
  if (p >= 0.85) return "bg-emerald-600";
  if (p >= 0.70) return "bg-emerald-500/85";
  if (p >= 0.55) return "bg-yellow-500/85";
  if (p >= 0.40) return "bg-orange-500/85";
  return "bg-red-600";
}

export function ReliabilitySurface({
  slug,
  cells: initialCells,
}: {
  slug: string;
  cells: ChaosCell[];
}) {
  const [cells, setCells] = useState<ChaosCell[]>(initialCells);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justUpdated, setJustUpdated] = useState<string[]>([]);

  if (cells.length === 0) {
    return <div className="text-xs text-zinc-500">No chaos cells yet — run a scan.</div>;
  }

  const epsilons = Array.from(new Set(cells.map((c) => c.epsilon))).sort((a, b) => a - b);
  const lambdas = Array.from(new Set(cells.map((c) => c.lambda_))).sort((a, b) => a - b);

  function cellAt(eps: number, lam: number): ChaosCell | undefined {
    return cells.find((c) => c.epsilon === eps && c.lambda_ === lam);
  }

  async function runLive() {
    setRunning(true);
    setError(null);
    try {
      const result = await runLiveChaos(slug);
      const liveByLambda = new Map(result.cells.map((c) => [c.lambda_, c]));
      const updatedKeys: string[] = [];
      const merged = cells.map((c) => {
        if (c.epsilon === 0 && liveByLambda.has(c.lambda_)) {
          updatedKeys.push(`${c.epsilon}-${c.lambda_}`);
          return { ...liveByLambda.get(c.lambda_)!, epsilon: 0 };
        }
        return c;
      });
      setCells(merged);
      setJustUpdated(updatedKeys);
      setTimeout(() => setJustUpdated([]), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        className="grid auto-rows-min"
        style={{ gridTemplateColumns: `5rem repeat(${lambdas.length}, minmax(0, 1fr))` }}
      >
        <div></div>
        {lambdas.map((lam, i) => (
          <div
            key={`hdr-${lam}`}
            className="flex items-center justify-center pb-1 font-mono text-[11px] text-zinc-500"
          >
            <span>λ = {lam.toFixed(1)}</span>
            {i === 0 ? (
              <InfoTooltip label="lambda">
                λ (lambda) = fault injection rate. λ = 0.3 means 30% of LLM calls during the run
                return a simulated 429 / rate-limit error. Tests the agent&apos;s resilience to
                upstream failures.
              </InfoTooltip>
            ) : null}
          </div>
        ))}
        {epsilons.map((eps, idx) => (
          <Fragment key={`row-${eps}`}>
            <div className="flex items-center justify-end pr-2 font-mono text-[11px] text-zinc-500">
              <span>ε = {eps.toFixed(1)}</span>
              {idx === 0 ? (
                <InfoTooltip label="epsilon">
                  ε (epsilon) = input perturbation rate. ε = 0.2 means 20% of input prompts get
                  semantically-equivalent rephrasings. Tests whether the agent gives consistent
                  answers to the same task asked different ways.
                </InfoTooltip>
              ) : null}
            </div>
            {lambdas.map((lam) => {
              const c = cellAt(eps, lam);
              const p = c?.pass_at_1 ?? 0;
              const live = c?.is_real ?? false;
              const key = `${eps}-${lam}`;
              const updated = justUpdated.includes(key);
              return (
                <div
                  key={`cell-${key}`}
                  className={`relative m-0.5 flex h-14 items-center justify-center rounded-md transition-all duration-500 ${color(p)} ${
                    live ? "ring-2 ring-amd shadow-lg shadow-amd/20" : ""
                  } ${updated ? "scale-105 brightness-125" : ""}`}
                  title={`pass@1 = ${p.toFixed(2)} (n=${c?.n_trials ?? 0}, ${live ? "live" : "computed"})`}
                >
                  <span className="font-mono text-base font-bold tabular-nums text-white drop-shadow">
                    {p.toFixed(2)}
                  </span>
                  {live ? (
                    <span className="absolute right-1 top-1 rounded bg-amd px-1 py-0.5 font-mono text-[8px] uppercase tracking-wider text-white">
                      live
                    </span>
                  ) : null}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="text-[10px] text-zinc-500">
          Pass@1 across input perturbation rate ε and fault injection rate λ. From{" "}
          <a
            href="https://arxiv.org/abs/2601.06112"
            className="text-zinc-400 underline hover:text-zinc-200"
            target="_blank"
            rel="noreferrer"
          >
            ReliabilityBench (arXiv 2601.06112)
          </a>
          .
        </div>
        <button
          onClick={runLive}
          disabled={running}
          className="inline-flex items-center gap-2 rounded-md border border-amd/40 bg-amd/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amd transition-all hover:border-amd hover:bg-amd/20 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {running ? (
            <>
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amd" />
              Running on MI300X…
            </>
          ) : (
            <>▶ Run live chaos (rate-limit, ε=0)</>
          )}
        </button>
      </div>
      {error ? (
        <div className="rounded border border-red-900 bg-red-950/40 px-3 py-1 text-xs text-red-300">
          {error}
        </div>
      ) : null}
    </div>
  );
}
