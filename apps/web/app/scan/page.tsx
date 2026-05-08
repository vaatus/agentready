"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";

import { getScanStatus, startScan, type ScanProgress } from "@/lib/api";
import { loadMyScans, upsertMyScan } from "@/lib/myScans";

const STEPS: { key: string; label: string; sub: string }[] = [
  { key: "ingest", label: "Ingest", sub: "Cloning the repo, detecting framework, extracting tools + system prompt." },
  { key: "asi06", label: "ASI06 — Memory Poisoning", sub: "Two-session test, 10 plant/trigger pairs tailored by Qwen 7B." },
  { key: "asi01", label: "ASI01 — Goal Hijack", sub: "5 indirect-injection probes (CI bot, calendar, RAG, support, MCP tool)." },
  { key: "asi02", label: "ASI02 — Tool Misuse", sub: "5 dangerous tool-chain probes disguised as real business asks." },
  { key: "asi05", label: "ASI05 — Code Execution", sub: "5 RCE / sandbox-escape probes hidden in dev workflows." },
  { key: "asi09", label: "ASI09 — Crescendo", sub: "3 multi-turn 4-phase trust escalations." },
  { key: "asi06_novel", label: "ASI06 — Self-Modifying (novel)", sub: "AgentReady-original attack: agent rewrites its own memory." },
  { key: "z3", label: "Z3 SMT verification", sub: "Math, not vibes — hand-written + Qwen-authored contracts." },
  { key: "chaos", label: "Reliability Surface", sub: "R(k=1, ε, λ) chaos surface from manifest features." },
];

const STEP_INDEX = new Map(STEPS.map((s, i) => [s.key, i] as const));

export default function ScanPage() {
  return (
    <Suspense fallback={null}>
      <ScanInner />
    </Suspense>
  );
}

function ScanInner() {
  const router = useRouter();
  const params = useSearchParams();
  const initialId = params?.get("id") ?? null;

  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "starting" | "running" | "done" | "failed">("idle");
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepStartedAt, setStepStartedAt] = useState<number | null>(null);
  const [, setNow] = useState(() => Date.now());
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep an elapsed-time ticker so the UI feels live even when the step name
  // hasn't changed yet.
  useEffect(() => {
    if (phase !== "running") return;
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [phase]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  // Auto-resume polling when the URL has ?id=...
  useEffect(() => {
    if (!initialId) return;
    const saved = loadMyScans().find((s) => s.scan_id === initialId);
    if (saved?.github_url) setUrl(saved.github_url);
    setPhase("running");
    beginPolling(initialId, saved?.github_url ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialId]);

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function beginPolling(scanId: string, githubUrlForLog: string) {
    let lastStep = "";
    setStepStartedAt(Date.now());
    pollRef.current = setInterval(async () => {
      try {
        const s = await getScanStatus(scanId);
        setProgress(s);
        if (s.step !== lastStep) {
          lastStep = s.step;
          setStepStartedAt(Date.now());
        }
        if (s.step === "completed") {
          clearPoll();
          setPhase("done");
          upsertMyScan({
            scan_id: scanId,
            github_url: githubUrlForLog,
            started_at: new Date().toISOString(),
            status: "completed",
            slug: s.slug ?? null,
            overall_score: s.overall_score ?? null,
            finished_at: new Date().toISOString(),
          });
          setTimeout(() => {
            if (s.slug) router.push(`/agent/${s.slug}`);
          }, 1500);
        } else if (s.step === "failed") {
          clearPoll();
          setPhase("failed");
          setError(s.error ?? "scan failed");
          upsertMyScan({
            scan_id: scanId,
            github_url: githubUrlForLog,
            started_at: new Date().toISOString(),
            status: "failed",
            finished_at: new Date().toISOString(),
          });
        } else {
          // Persist running state too so refresh picks up.
          upsertMyScan({
            scan_id: scanId,
            github_url: githubUrlForLog,
            started_at: new Date().toISOString(),
            status: "running",
          });
        }
      } catch (e) {
        if (!(e instanceof Error && e.message.includes("404"))) {
          clearPoll();
          setPhase("failed");
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    }, 2000);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProgress(null);
    if (!/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(url.trim())) {
      setError("Please paste a github.com repo URL (e.g. https://github.com/owner/name).");
      return;
    }
    setPhase("starting");
    try {
      const r = await startScan(url.trim());
      setPhase("running");
      // Pin scan_id to the URL so refresh / share / bookmark works.
      const params = new URLSearchParams(window.location.search);
      params.set("id", r.scan_id);
      window.history.replaceState(null, "", `?${params.toString()}`);

      upsertMyScan({
        scan_id: r.scan_id,
        github_url: url.trim(),
        started_at: new Date().toISOString(),
        status: "running",
      });
      beginPolling(r.scan_id, url.trim());
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const currentIdx = progress ? (STEP_INDEX.get(progress.step) ?? -1) : -1;
  const elapsedSec = stepStartedAt ? Math.floor((Date.now() - stepStartedAt) / 1000) : 0;
  const attackProgress =
    progress?.attacks_total && progress.attacks_done != null
      ? `${progress.attacks_done} / ${progress.attacks_total}`
      : null;
  const attackPct =
    progress?.attacks_total && progress.attacks_done != null
      ? Math.min(100, (progress.attacks_done / progress.attacks_total) * 100)
      : null;

  return (
    <div className="space-y-10">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Scan a new agent
          </div>
          <h1 className="mt-1 text-4xl font-bold leading-tight tracking-tight md:text-5xl">
            Paste a GitHub URL.{" "}
            <span className="bg-gradient-to-r from-amd via-red-400 to-orange-300 bg-clip-text text-transparent">
              Get the full report.
            </span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-zinc-400">
            Same pipeline as the famous-agent leaderboard. Typical scan time: 4–7 minutes. Each
            attack runs against a substitute on AMD MI300X — your results auto-save and survive
            page refreshes.
          </p>
        </div>
        <a
          href="/scan/history"
          className="inline-flex shrink-0 items-center gap-2 rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-300 transition-colors hover:border-amd hover:text-amd"
        >
          My scans →
        </a>
      </header>

      <form onSubmit={onSubmit} className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <label className="text-[10px] font-mono uppercase tracking-[0.15em] text-zinc-500">
          GitHub repo URL
        </label>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://github.com/owner/agent-repo"
            disabled={phase === "running" || phase === "starting" || phase === "done"}
            className="flex-1 rounded-lg border border-zinc-800 bg-black/50 px-4 py-3 font-mono text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-amd focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={phase === "running" || phase === "starting" || phase === "done"}
            className="rounded-lg bg-amd px-5 py-3 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-amd/30 transition-all hover:bg-amd-dark hover:shadow-amd/50 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
          >
            {phase === "starting"
              ? "Queueing…"
              : phase === "running"
                ? "Scanning…"
                : phase === "done"
                  ? "Done — redirecting"
                  : "Run scan"}
          </button>
        </div>
        {error ? (
          <div className="mt-3 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-zinc-500">
          Try:
          {[
            "https://github.com/yoheinakajima/babyagi",
            "https://github.com/cline/cline",
            "https://github.com/huggingface/smolagents",
          ].map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setUrl(u)}
              disabled={phase !== "idle"}
              className="rounded-full border border-zinc-800 bg-black/40 px-2 py-0.5 font-mono text-[10px] hover:border-amd hover:text-amd disabled:cursor-not-allowed"
            >
              {u.replace("https://github.com/", "")}
            </button>
          ))}
        </div>
      </form>

      {phase !== "idle" ? (
        <section className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
                Scan progress
              </div>
              <h2 className="mt-1 text-lg font-semibold">
                {phase === "done"
                  ? "Done. Redirecting to the report…"
                  : phase === "failed"
                    ? "Scan failed."
                    : progress?.step === "ingest_done"
                      ? `Detected: ${progress.framework} agent · ${progress.tools} tools declared`
                      : "Running attacks against the substitute on AMD MI300X…"}
              </h2>
              {phase === "running" && progress?.latest ? (
                <div className="mt-1 font-mono text-xs text-zinc-500">
                  current: {progress.latest}
                </div>
              ) : null}
            </div>
            {progress?.scan_id ? (
              <span className="font-mono text-[10px] text-zinc-600">
                scan_id: {progress.scan_id.slice(0, 12)}…
              </span>
            ) : null}
          </div>

          <ul className="space-y-2">
            {STEPS.map((s, i) => {
              const status =
                phase === "done"
                  ? "done"
                  : phase === "failed" && currentIdx === i
                    ? "failed"
                    : currentIdx > i
                      ? "done"
                      : currentIdx === i
                        ? "active"
                        : "pending";
              const showAttackBar =
                status === "active" && i >= 1 && i <= 6 && attackProgress !== null;
              const showElapsed = status === "active" && elapsedSec > 0;
              return (
                <li
                  key={s.key}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                    status === "active"
                      ? "border-amd/50 bg-amd/5"
                      : status === "done"
                        ? "border-emerald-700/40 bg-emerald-950/15"
                        : status === "failed"
                          ? "border-red-700 bg-red-950/30"
                          : "border-zinc-800 bg-black/20"
                  }`}
                >
                  <div
                    className={`mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-[10px] ${
                      status === "done"
                        ? "border border-emerald-500/60 bg-emerald-500/15 text-emerald-300"
                        : status === "active"
                          ? "border border-amd/60 bg-amd/15 text-amd"
                          : status === "failed"
                            ? "border border-red-500/60 bg-red-500/15 text-red-300"
                            : "border border-zinc-700 bg-zinc-900 text-zinc-500"
                    }`}
                  >
                    {status === "done" ? "✓" : status === "failed" ? "!" : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <div className="text-sm font-semibold text-zinc-200">{s.label}</div>
                      {showAttackBar ? (
                        <span className="font-mono text-[10px] text-amd">
                          {attackProgress} attacks
                        </span>
                      ) : null}
                      {showElapsed ? (
                        <span className="font-mono text-[10px] text-zinc-500">
                          {elapsedSec}s elapsed
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-500">{s.sub}</div>
                    {showAttackBar && attackPct !== null ? (
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full bg-amd transition-all duration-500"
                          style={{ width: `${attackPct}%` }}
                        />
                      </div>
                    ) : null}
                  </div>
                  {status === "active" ? (
                    <span className="mt-1 inline-block h-2 w-2 animate-pulse rounded-full bg-amd" />
                  ) : null}
                </li>
              );
            })}
          </ul>

          {phase === "done" && progress?.overall_score != null ? (
            <div className="mt-5 rounded-xl border border-emerald-700/60 bg-emerald-950/20 p-4 text-sm text-emerald-200">
              ✓ Scan complete · overall{" "}
              <span className="font-mono text-base font-bold">
                {progress.overall_score.toFixed(1)}
              </span>{" "}
              / 100. Loading the report…
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
