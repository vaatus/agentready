"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { getScanStatus } from "@/lib/api";
import { loadMyScans, removeMyScan, type SavedScan, upsertMyScan } from "@/lib/myScans";

export default function ScanHistoryPage() {
  const [scans, setScans] = useState<SavedScan[]>([]);
  const [loaded, setLoaded] = useState(false);
  const refreshing = useRef(false);

  useEffect(() => {
    setScans(loadMyScans());
    setLoaded(true);
  }, []);

  // Refresh statuses for any "running" / "queued" / unknown entries every 5s.
  useEffect(() => {
    let cancelled = false;
    async function tick() {
      if (refreshing.current) return;
      refreshing.current = true;
      try {
        const all = loadMyScans();
        const stillOpen = all.filter(
          (s) => s.status === "running" || s.status === "queued" || !s.status,
        );
        if (stillOpen.length === 0) return;
        await Promise.all(
          stillOpen.map(async (s) => {
            try {
              const p = await getScanStatus(s.scan_id);
              if (p.step === "completed") {
                upsertMyScan({
                  ...s,
                  status: "completed",
                  slug: p.slug ?? null,
                  overall_score: p.overall_score ?? null,
                  finished_at: new Date().toISOString(),
                });
              } else if (p.step === "failed") {
                upsertMyScan({ ...s, status: "failed", finished_at: new Date().toISOString() });
              } else {
                upsertMyScan({ ...s, status: "running" });
              }
            } catch {
              /* keep prior status */
            }
          }),
        );
        if (!cancelled) setScans(loadMyScans());
      } finally {
        refreshing.current = false;
      }
    }
    void tick();
    const interval = setInterval(tick, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  function onRemove(id: string) {
    setScans(removeMyScan(id));
  }

  function statusPill(s: SavedScan) {
    const status = s.status ?? "unknown";
    if (status === "completed")
      return (
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-emerald-300">
          completed
        </span>
      );
    if (status === "failed")
      return (
        <span className="rounded-full bg-red-500/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-red-300">
          failed
        </span>
      );
    if (status === "running" || status === "queued")
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amd/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amd">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amd" />
          {status}
        </span>
      );
    return (
      <span className="rounded-full bg-zinc-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
        unknown
      </span>
    );
  }

  return (
    <div className="space-y-8">
      <header className="flex items-end justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">My scans</div>
          <h1 className="mt-1 text-4xl font-bold tracking-tight md:text-5xl">Scans you launched</h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">
            Stored in your browser only. Refreshes every 5 seconds — running scans update live, no
            sign-in required.
          </p>
        </div>
        <Link
          href="/scan"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-amd px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-amd/30 transition-all hover:bg-amd-dark"
        >
          + New scan
        </Link>
      </header>

      {!loaded ? (
        <div className="text-sm text-zinc-500">loading…</div>
      ) : scans.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center text-sm text-zinc-400">
          No scans yet — paste a GitHub URL on the{" "}
          <Link href="/scan" className="text-amd hover:underline">
            scan page
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-3">
          {scans.map((s) => (
            <div
              key={s.scan_id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {statusPill(s)}
                  <span className="font-mono text-[10px] text-zinc-600">
                    {s.scan_id.slice(0, 12)}…
                  </span>
                  {s.overall_score != null ? (
                    <span className="font-mono text-xs text-zinc-300">
                      score{" "}
                      <span className="font-bold text-emerald-300">
                        {s.overall_score.toFixed(1)}
                      </span>
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 truncate font-mono text-sm text-zinc-200">
                  {s.github_url}
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  started {new Date(s.started_at).toLocaleString()}
                  {s.finished_at ? ` · finished ${new Date(s.finished_at).toLocaleString()}` : null}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {s.status === "completed" && s.slug ? (
                  <Link
                    href={`/agent/${s.slug}`}
                    className="rounded-md border border-amd/40 bg-amd/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-amd hover:bg-amd/20"
                  >
                    View report
                  </Link>
                ) : (s.status === "running" || s.status === "queued" || !s.status) ? (
                  <Link
                    href={`/scan?id=${encodeURIComponent(s.scan_id)}`}
                    className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-200 hover:border-amd hover:text-amd"
                  >
                    Open
                  </Link>
                ) : null}
                <button
                  onClick={() => onRemove(s.scan_id)}
                  className="rounded-md border border-zinc-800 bg-black/40 px-3 py-1.5 text-xs text-zinc-500 hover:border-red-700 hover:text-red-300"
                  aria-label="Remove from history"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
