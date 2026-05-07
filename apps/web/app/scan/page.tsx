"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { getScanStatus, startScan, type ScanProgress } from "@/lib/api";

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
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<"idle" | "starting" | "running" | "done" | "failed">("idle");
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^https?:\/\/(www\.)?github\.com\/[^/]+\/[^/]+/i.test(url.trim())) {
      setError("Please paste a github.com repo URL (e.g. https://github.com/owner/name).");
      return;
    }
    setPhase("starting");
    try {
      const r = await startScan(url.trim());
      setPhase("running");
      let lastStep = "";
      pollRef.current = setInterval(async () => {
        try {
          const s = await getScanStatus(r.scan_id);
          setProgress(s);
          if (s.step !== lastStep) {
            lastStep = s.step;
          }
          if (s.step === "completed") {
            clearPoll();
            setPhase("done");
            // Redirect to the agent page after a brief beat so the user sees the success state.
            setTimeout(() => {
              if (s.slug) router.push(`/agent/${s.slug}`);
            }, 1200);
          } else if (s.step === "failed") {
            clearPoll();
            setPhase("failed");
            setError(s.error ?? "scan failed");
          }
        } catch (e) {
          // 404 is expected briefly during the first poll if backend hasn't queued yet.
          if (!(e instanceof Error && e.message.includes("404"))) {
            clearPoll();
            setPhase("failed");
            setError(e instanceof Error ? e.message : String(e));
          }
        }
      }, 2000);
    } catch (e) {
      setPhase("failed");
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const currentIdx = progress ? (STEP_INDEX.get(progress.step) ?? -1) : -1;

  return (
    <div className="space-y-10">
      <header>
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
          Same pipeline as the famous-agent leaderboard. We clone the repo, extract its tools and
          system prompt, run the OWASP ASI-2026 attack suite (5 live categories) against a substitute
          on AMD MI300X, formally verify with Z3, and produce the per-agent report. Typical scan
          time: 4–7 minutes.
        </p>
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
          <div className="mb-4 flex items-center justify-between">
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
                    <div className="text-sm font-semibold text-zinc-200">{s.label}</div>
                    <div className="text-xs text-zinc-500">{s.sub}</div>
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
