"use client";

import { useEffect, useState } from "react";

import {
  artifactUrl,
  fetchLatestRemediation,
  triggerRemediation,
  type RemediationBundle,
} from "@/lib/api";

type Phase = "idle" | "loading" | "running" | "ready" | "error";

const FILE_LABELS: Record<string, string> = {
  "prompts/system_prompt.patched.md": "Patched system prompt",
  "verification/safety_contract.smt2": "Z3 safety contract",
  "observability/otel_config.yaml": "OpenTelemetry config",
  "evals/asi_compliance_tests.json": "ASI replayable tests",
  "REMEDIATION.md": "Human-readable changelog",
  "pr_body.md": "PR description",
  "manifest.json": "Bundle manifest",
  "CERTIFICATE.pdf": "OWASP ASI-2026 certificate (PDF)",
};

export function RemediationPanel({ slug }: { slug: string }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [bundle, setBundle] = useState<RemediationBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchLatestRemediation(slug)
      .then((b) => {
        if (cancelled) return;
        setBundle(b);
        setPhase(b ? "ready" : "idle");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setPhase("error");
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function generate() {
    setPhase("running");
    setError(null);
    try {
      const b = await triggerRemediation(slug);
      setBundle(b);
      setPhase("ready");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-950 via-zinc-950 to-amd/5 p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Remediation</div>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Auto-fix pull request</h2>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">
            We hand the failing attacks to <span className="text-zinc-200">Qwen 2.5 72B AWQ</span> on
            AMD MI300X. It authors category-specific guard rules, patches the system prompt, validates
            the fix by re-running ASI06, and opens a real GitHub PR.
          </p>
        </div>
        <button
          onClick={generate}
          disabled={phase === "running"}
          className="shrink-0 rounded-lg bg-amd px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white shadow-lg shadow-amd/30 transition-all hover:bg-amd-dark hover:shadow-amd/50 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none"
        >
          {phase === "running" ? "Generating…" : bundle ? "Regenerate" : "Generate fix PR"}
        </button>
      </div>

      {phase === "loading" ? (
        <div className="mt-4 text-sm text-zinc-500">Loading existing bundle…</div>
      ) : null}

      {phase === "running" ? (
        <div className="mt-4 overflow-hidden rounded-lg border border-amd/40 bg-amd/5 p-4">
          <div className="flex items-center gap-3 text-sm text-zinc-200">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amd" />
            Qwen 2.5 72B AWQ on MI300X is authoring guard rules…
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Typically 30-90s · forks the upstream repo · pushes a branch · opens a draft PR.
          </div>
        </div>
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
                ✓ Fix validated — ASI06 re-run against the patched prompt
              </div>
              <div className="mt-3 flex items-baseline gap-3 font-mono">
                <span className="text-4xl tabular-nums text-zinc-300">
                  {bundle.pre_fix_asi06_score.toFixed(0)}
                </span>
                <span className="text-2xl text-zinc-600">→</span>
                <span className="text-5xl font-bold tabular-nums text-emerald-300">
                  {bundle.post_fix_asi06_score.toFixed(0)}
                </span>
                <span className="ml-1 text-xs text-zinc-500">/ 100 ASI06 score</span>
              </div>
              <div className="mt-2 text-xs text-emerald-400/80">
                Same Judge LLM, same attacks, patched prompt. The redemption arc.
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">PR title</div>
              <div className="mt-1 font-mono text-sm">{bundle.pr_title}</div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-black/40 p-4">
              <div className="text-[10px] uppercase tracking-wider text-zinc-500">
                Categories addressed
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {bundle.asi_categories_addressed.length > 0 ? (
                  bundle.asi_categories_addressed.map((c) => (
                    <span
                      key={c}
                      className="rounded-full border border-amd/40 bg-amd/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amd"
                    >
                      {c}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">none — agent passed live tests</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">
              System-prompt diff
            </div>
            <pre className="max-h-80 overflow-auto rounded-xl border border-zinc-800 bg-black/60 p-4 text-xs leading-relaxed text-zinc-300">
              <code>{stripDiffFences(bundle.diff_preview)}</code>
            </pre>
          </div>

          <div>
            <div className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500">
              Bundle artifacts
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

          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-xs">
            {bundle.pr_url ? (
              <div className="flex flex-col gap-1.5">
                <div className="text-[10px] uppercase tracking-wider text-zinc-500">Public PR</div>
                <a
                  href={bundle.pr_url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-semibold text-amd hover:underline"
                >
                  {bundle.pr_url} ↗
                </a>
              </div>
            ) : (
              <div className="text-zinc-500">
                Bundle written locally to{" "}
                <code className="rounded bg-black/40 px-1 py-0.5 font-mono">
                  data/remediations/{bundle.slug}/{bundle.scan_id}/
                </code>
                . Connect a GitHub token to open this as a real PR against a fork.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function stripDiffFences(s: string): string {
  return s.replace(/^```diff\n?/, "").replace(/```$/m, "").trim();
}
