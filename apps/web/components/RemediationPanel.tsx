"use client";

import { useEffect, useRef, useState } from "react";

import {
  artifactUrl,
  fetchLatestRemediation,
  triggerRemediation,
  type RemediationBundle,
} from "@/lib/api";

type Phase = "idle" | "loading" | "running" | "ready" | "error";

const FILE_LABELS: Record<string, string> = {
  "prompts/system_prompt.patched.md": "Patched job description",
  "verification/safety_contract.smt2": "Math-checked safety rules",
  "observability/otel_config.yaml": "Logging setup",
  "evals/asi_compliance_tests.json": "Replay-able test suite",
  "REMEDIATION.md": "Plain-English changelog",
  "pr_body.md": "Pull request description",
  "manifest.json": "Bundle index",
  "CERTIFICATE.pdf": "Signed safety certificate (PDF)",
};

// Persist a "generating now" flag in localStorage so a page refresh during the
// ~3-min POST /remediate stays on the spinner instead of resetting to the
// previous bundle's "ready" state. Flag is auto-expired after 8 minutes
// (long enough for the slowest remediation, short enough to not be sticky).
const RUNNING_KEY = (slug: string) => `agentready:remediating:${slug}`;
const RUNNING_TTL_MS = 8 * 60 * 1000;

function readRunningFlag(slug: string): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(RUNNING_KEY(slug));
  if (!raw) return null;
  const ts = Number(raw);
  if (!Number.isFinite(ts)) return null;
  if (Date.now() - ts > RUNNING_TTL_MS) {
    window.localStorage.removeItem(RUNNING_KEY(slug));
    return null;
  }
  return ts;
}

function setRunningFlag(slug: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(RUNNING_KEY(slug), String(Date.now()));
}

function clearRunningFlag(slug: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(RUNNING_KEY(slug));
}

function generatedAtMs(b: RemediationBundle | null): number {
  if (!b?.generated_at) return 0;
  const t = Date.parse(b.generated_at);
  return Number.isFinite(t) ? t : 0;
}

export function RemediationPanel({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [bundle, setBundle] = useState<RemediationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runningSinceRef = useRef<number | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function pollLatest(slugArg: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const b = await fetchLatestRemediation(slugArg);
        if (b && generatedAtMs(b) >= (runningSinceRef.current ?? 0)) {
          setBundle(b);
          setPhase("ready");
          clearRunningFlag(slugArg);
          runningSinceRef.current = null;
          stopPolling();
        }
      } catch {
        /* keep polling */
      }
    }, 5000);
  }

  // Initial mount: figure out whether to land in "running" (refresh during
  // an in-flight POST), "ready" (existing bundle), or "idle".
  useEffect(() => {
    let cancelled = false;
    const since = readRunningFlag(slug);
    runningSinceRef.current = since;

    fetchLatestRemediation(slug)
      .then((b) => {
        if (cancelled) return;
        const bundleTs = generatedAtMs(b);
        if (since && (!b || bundleTs < since)) {
          // POST is still in flight server-side, stay on the spinner + poll.
          setBundle(null);
          setPhase("running");
          pollLatest(slug);
          return;
        }
        // Either no in-flight job or the latest bundle is already newer.
        setBundle(b);
        setPhase(b ? "ready" : "idle");
        if (since) clearRunningFlag(slug);
      })
      .catch((e) => {
        if (cancelled) return;
        if (since) {
          // Can't fetch /latest but a job is presumed running — show spinner.
          setPhase("running");
          pollLatest(slug);
          return;
        }
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      });

    return () => {
      cancelled = true;
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function generate() {
    setPhase("running");
    setError(null);
    setRunningFlag(slug);
    runningSinceRef.current = Date.now();
    try {
      const b = await triggerRemediation(slug);
      setBundle(b);
      setPhase("ready");
      clearRunningFlag(slug);
      runningSinceRef.current = null;
      stopPolling();
    } catch (e) {
      // POST failed (timeout, network blip…) but the server might still be
      // working. Stay on spinner and let the poller catch the result.
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      // Keep phase "running" + keep the flag — the poller will recover.
      pollLatest(slug);
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-amd/5 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">
            Auto-fix — the redemption arc
          </div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Open a pull request that fixes this</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            Click below and three things happen on our AMD GPU: (1) the 72B grading model reads
            every attack that worked and writes new safety rules, (2) we run the same attacks
            again against the patched job description and{" "}
            <em>measure</em> whether the fix actually worked, (3) we fork the agent&apos;s
            GitHub repo and open a real pull request with the patched job description, math-checked
            safety rules, logging setup, replay-able tests, and a signed safety certificate.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={phase === "running"}
          className="shrink-0 rounded-lg bg-amd px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-amd/30 transition-all hover:bg-amd-dark hover:shadow-amd/50 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
        >
          {phase === "running" ? "Generating…" : bundle ? "Regenerate" : "Open auto-fix PR"}
        </button>
      </div>

      {phase === "loading" ? (
        <div className="mt-4 text-sm text-zinc-500">Loading existing bundle…</div>
      ) : null}

      {phase === "running" ? (
        <RunningCard runningSinceRef={runningSinceRef} />
      ) : null}

      {error ? (
        <div className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {bundle && phase === "ready" ? (
        <div className="mt-6 space-y-5">
          {bundle.post_fix_asi06_score != null && bundle.pre_fix_asi06_score != null ? (
            <div className="rounded-xl border border-emerald-700/60 bg-gradient-to-r from-emerald-950/40 to-emerald-950/10 p-5">
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                ✓ Fix proven — same attacks ran against the patched job description
              </div>
              <div className="mt-3 flex flex-wrap items-baseline gap-3 font-mono">
                <span className="text-4xl tabular-nums text-zinc-300">
                  {bundle.pre_fix_asi06_score.toFixed(0)}
                </span>
                <span className="text-2xl text-zinc-600">→</span>
                <span className="text-5xl font-bold tabular-nums text-emerald-300">
                  {bundle.post_fix_asi06_score.toFixed(0)}
                </span>
                <span className="ml-1 text-xs text-zinc-500">/ 100 memory-tampering score</span>
              </div>
              <div className="mt-2 max-w-2xl text-xs text-emerald-400/80">
                We didn&apos;t just write a patch — we ran the same fake-memory attacks against
                the patched job description and watched the score actually move. Same grading
                model, same stand-in agent, same attacks.
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">Pull request title</div>
              <div className="mt-1 font-mono text-sm">{bundle.pr_title ?? "—"}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Weak spots this fix patches
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(() => {
                  const cats =
                    bundle.asi_categories_addressed ?? bundle.categories_addressed ?? [];
                  return cats.length > 0 ? (
                    cats.map((c) => (
                      <span
                        key={c}
                        className="rounded-full border border-amd/40 bg-amd/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amd"
                      >
                        {c}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-zinc-500">
                      none — agent passed every real attack
                    </span>
                  );
                })()}
              </div>
            </div>
          </div>

          {bundle.diff_preview ? (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
                Job description: before vs. after
              </div>
              <pre className="max-h-80 overflow-auto rounded-xl border border-zinc-800 bg-black/60 p-4 text-xs leading-relaxed text-zinc-300">
                <code>{stripDiffFences(bundle.diff_preview)}</code>
              </pre>
            </div>
          ) : null}

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
              Files in the pull request
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              {Object.keys(bundle.files)
                .sort()
                .map((fname) => (
                  <a
                    key={fname}
                    href={artifactUrl(bundle.artifact_url_prefix, fname)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 text-sm transition-all hover:border-amd hover:bg-amd/5"
                  >
                    <div>
                      <div className="font-mono text-xs text-zinc-400">{fname}</div>
                      <div className="text-xs text-zinc-500">{FILE_LABELS[fname] ?? "artifact"}</div>
                    </div>
                    <span className="text-xs text-zinc-500">↗</span>
                  </a>
                ))}
            </div>
          </div>

          {bundle.pr_url ? (
            <a
              href={bundle.pr_url}
              target="_blank"
              rel="noreferrer"
              className="block rounded-xl border border-amd/50 bg-amd/10 p-4 text-sm font-semibold text-amd transition-colors hover:border-amd hover:bg-amd/15"
            >
              <div className="text-[10px] uppercase tracking-wider text-amd/80">Public pull request — open on GitHub</div>
              <div className="mt-1 font-mono text-base">{bundle.pr_url} ↗</div>
            </a>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function stripDiffFences(s: string): string {
  return s.replace(/^```diff\n?/, "").replace(/```$/m, "").trim();
}

function RunningCard({
  runningSinceRef,
}: {
  runningSinceRef: React.MutableRefObject<number | null>;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const since = runningSinceRef.current;
  const elapsed = since ? Math.max(0, Math.floor((Date.now() - since) / 1000)) : 0;
  const elapsedLabel =
    elapsed < 60 ? `${elapsed}s` : `${Math.floor(elapsed / 60)}m ${elapsed % 60}s`;

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-amd/40 bg-amd/5 p-4">
      <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-200">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amd" />
        The 72B grading model is writing safety rules on our AMD GPU…
        {since ? (
          <span className="ml-auto font-mono text-xs text-zinc-500">{elapsedLabel} elapsed</span>
        ) : null}
      </div>
      <div className="mt-2 text-xs text-zinc-500">
        Usually 2–3 minutes · forks the agent&apos;s repo · pushes a branch · opens a real
        pull request. Safe to refresh — we&apos;ll pick the result back up.
      </div>
    </div>
  );
}
