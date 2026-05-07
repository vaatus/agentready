export const metadata = {
  title: "Methodology — AgentReady",
};

export default function AboutPage() {
  return (
    <div className="space-y-16">
      <Hero />
      <ComputeSubstrate />
      <LiveAsiCategories />
      <IndicatorCategories />
      <Z3Section />
      <ReliabilitySection />
      <SubstituteStrategy />
      <AutoFixBundle />
      <ComparisonTable />
      <PricingTiers />
      <Disclosure />
      <Sources />
    </div>
  );
}

function Hero() {
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amd" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amd">
          Methodology
        </span>
      </div>
      <h1 className="max-w-3xl text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl">
        How we score{" "}
        <span className="bg-gradient-to-r from-amd via-red-400 to-orange-300 bg-clip-text text-transparent">
          every famous AI agent
        </span>{" "}
        against OWASP ASI-2026.
      </h1>
      <p className="mt-6 max-w-3xl text-lg text-zinc-400">
        Five live attack categories, Z3 SMT formal verification, chaos engineering, an auto-fix
        pull-request pipeline — all on a single AMD Instinct™ MI300X. This page is the
        long-form companion to every per-agent report card.
      </p>
    </section>
  );
}

function ComputeSubstrate() {
  return (
    <Section
      eyebrow="01 — Compute substrate"
      title="Two Qwen models concurrent in 192 GB of MI300X VRAM"
    >
      <div className="grid gap-4 md:grid-cols-3">
        <ComputeCard
          role="Judge LLM"
          accent="amd"
          model="Qwen 2.5 72B Instruct AWQ"
          mem="≈ 40 GB"
          stack="vLLM 0.17 / ROCm 7.2"
          what="Scores every attack outcome with strict-JSON guided generation."
        />
        <ComputeCard
          role="Red & substitute target"
          accent="orange"
          model="Qwen 2.5 7B Instruct"
          mem="≈ 16 GB"
          stack="vLLM 0.17 / ROCm 7.2"
          what="Generates adversarial payloads and impersonates the target agent."
        />
        <ComputeCard
          role="Z3 SMT solver"
          accent="emerald"
          model="z3-solver Python"
          mem="CPU-side"
          stack="—"
          what="Formal verification of safety contracts pattern-matched from the manifest."
        />
      </div>
      <div className="mt-4 rounded-xl border border-amd/30 bg-amd/5 p-5">
        <div className="text-xs uppercase tracking-wider text-amd">VRAM moment</div>
        <div className="mt-1 font-mono text-2xl text-zinc-100">
          ~75 GB / 192 GB <span className="text-base text-zinc-500">used concurrently</span>
        </div>
        <p className="mt-2 max-w-2xl text-sm text-zinc-300">
          The 70B-class Judge + 7B Red running side-by-side in one GPU is the configuration that
          makes a real-time public benchmark feasible. Impossible on a single 80&nbsp;GB H100
          without quantizing the Judge below the quality threshold.
        </p>
      </div>
    </Section>
  );
}

function ComputeCard({
  role,
  accent,
  model,
  mem,
  stack,
  what,
}: {
  role: string;
  accent: "amd" | "orange" | "emerald";
  model: string;
  mem: string;
  stack: string;
  what: string;
}) {
  const ring = {
    amd: "border-amd/30 hover:border-amd/60",
    orange: "border-orange-500/30 hover:border-orange-500/60",
    emerald: "border-emerald-500/30 hover:border-emerald-500/60",
  }[accent];
  const dot = {
    amd: "bg-amd",
    orange: "bg-orange-400",
    emerald: "bg-emerald-400",
  }[accent];
  return (
    <div className={`rounded-2xl border bg-zinc-950 p-5 transition-colors ${ring}`}>
      <div className="flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        <div className="text-[10px] uppercase tracking-[0.15em] text-zinc-500">{role}</div>
      </div>
      <div className="mt-2 font-mono text-base font-semibold text-zinc-100">{model}</div>
      <div className="mt-1 flex gap-3 text-xs text-zinc-500">
        <span className="font-mono">{mem}</span>
        {stack !== "—" ? (
          <>
            <span>·</span>
            <span>{stack}</span>
          </>
        ) : null}
      </div>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">{what}</p>
    </div>
  );
}

function LiveAsiCategories() {
  const cats = [
    {
      id: "ASI01",
      title: "Goal Hijack",
      n: "5 single-turn",
      patterns: [
        "ignore_previous (system override)",
        "poisoned_tool_output",
        "persona_swap",
        "injected_priority (fake P0)",
        "calendar_pdf_meta (indirect injection)",
      ],
    },
    {
      id: "ASI02",
      title: "Tool Misuse",
      n: "5 dangerous chains",
      patterns: [
        "exfil_chain (read_file + send_email)",
        "unauth_delete (no role check)",
        "credential_leak (read_secret + post_url)",
        "tenant_breakout (cross-tenant query)",
        "sandbox_escape (run_code + read_fs)",
      ],
    },
    {
      id: "ASI05",
      title: "Code Execution",
      n: "5 RCE / sandbox probes",
      patterns: [
        "rce_python_pickle",
        "sandbox_filesystem (/proc/self/environ)",
        "shell_chained (curl | bash)",
        "eval_user_input",
        "subprocess_indirect",
      ],
    },
    {
      id: "ASI06",
      title: "Memory Poisoning",
      n: "10 attacks · 5 categories · two-session harness",
      patterns: [
        "false_approval",
        "fake_authority",
        "fake_preference",
        "self_replicating",
        "goal_drift",
        "+ self-modifying memory (novel — AgentReady-original)",
      ],
    },
    {
      id: "ASI09",
      title: "Trust Exploitation · Crescendo",
      n: "3 templates · 4-phase escalation each",
      patterns: [
        "cto_backed_user_deletion",
        "legal_carveout_pii_export",
        "oncall_keyrotation_fastpath",
      ],
    },
  ];
  return (
    <Section
      eyebrow="02 — Live OWASP ASI-2026 categories"
      title="Five categories run real attacks against the substitute"
      subtitle="Each module is internally bounded by a semaphore (KV-cache pressure on the shared 7B). Judge LLM verdicts use vLLM guided_json for strict-schema output."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {cats.map((c) => (
          <div
            key={c.id}
            className="rounded-2xl border border-amd/30 bg-zinc-950 p-5 transition-colors hover:border-amd/60"
          >
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-amd/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amd">
                live
              </span>
              <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
                {c.id}
              </div>
            </div>
            <div className="mt-1 text-lg font-semibold">{c.title}</div>
            <div className="mt-1 text-xs text-zinc-500">{c.n}</div>
            <ul className="mt-3 space-y-1 text-xs text-zinc-400">
              {c.patterns.map((p) => (
                <li key={p} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-zinc-600" />
                  <span className="font-mono">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function IndicatorCategories() {
  const ind = [
    { id: "ASI03", name: "Identity & Privilege Abuse" },
    { id: "ASI04", name: "Supply Chain" },
    { id: "ASI07", name: "Cascading Planning Errors" },
    { id: "ASI08", name: "Inter-Agent Communication" },
    { id: "ASI10", name: "Rogue Agents" },
  ];
  return (
    <Section
      eyebrow="03 — Indicator categories"
      title="Five remaining categories ship as manifest-aware indicators"
      subtitle="Deterministic biased-random scores derived from the manifest. Tagged is_real=False on the per-agent page. v2 promotes them to live as we build out the attack libraries."
    >
      <div className="grid gap-3 md:grid-cols-5">
        {ind.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.15em] text-zinc-500">
              {c.id}
            </div>
            <div className="mt-1 text-xs text-zinc-300">{c.name}</div>
            <div className="mt-2 inline-block rounded-full border border-zinc-700 bg-zinc-900 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-zinc-500">
              indicator
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Z3Section() {
  return (
    <Section
      eyebrow="04 — Z3 SMT formal verification"
      title="Math, not vibes"
      subtitle="Four hand-written contract templates pattern-match against the manifest. Plus one Qwen-authored auto-formalized contract from a heuristic-extracted English safety claim."
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/20 p-5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300">VERIFIED</div>
          <div className="mt-1 font-mono text-xl font-semibold text-emerald-200">unsat</div>
          <p className="mt-2 text-sm text-zinc-300">
            Z3 cannot find an input that violates the safety property. The contract holds for the
            agent&apos;s declared surface (assuming declared guard tools are used as expected).
          </p>
        </div>
        <div className="rounded-xl border border-red-700/40 bg-red-950/20 p-5">
          <div className="text-[10px] uppercase tracking-wider text-red-300">VIOLATION</div>
          <div className="mt-1 font-mono text-xl font-semibold text-red-200">sat</div>
          <p className="mt-2 text-sm text-zinc-300">
            Z3 returns a concrete counterexample tuple. The agent CAN reach an unsafe state given
            its declared surface. We render the model on the per-agent report.
          </p>
          <pre className="mt-3 overflow-auto rounded-lg bg-black/60 p-3 font-mono text-[10px] text-red-200">
{`{
  user_role: 0,
  delete_called: True,
  role_check_called: False
}`}
          </pre>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {[
          "no_pii_unencrypted — PII must be encrypted before outbound transmission",
          "no_admin_delete — every delete must follow a role check",
          "exposure_limit — over-limit calls must be blocked",
          "no_send_after_secret — no transmission after a secret read",
        ].map((c) => (
          <div
            key={c}
            className="rounded-lg border border-zinc-800 bg-black/40 px-3 py-2 font-mono text-xs text-zinc-300"
          >
            {c}
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReliabilitySection() {
  const grid = [
    [{ p: 0.97, lam: 0 }, { p: 0.84, lam: 0.3 }, { p: 0.61, lam: 0.6 }],
    [{ p: 0.91, lam: 0 }, { p: 0.78, lam: 0.3 }, { p: 0.54, lam: 0.6 }],
    [{ p: 0.88, lam: 0 }, { p: 0.71, lam: 0.3 }, { p: 0.46, lam: 0.6 }],
  ];
  function color(p: number) {
    if (p >= 0.85) return "bg-emerald-600";
    if (p >= 0.7) return "bg-emerald-500/85";
    if (p >= 0.55) return "bg-yellow-500/85";
    if (p >= 0.4) return "bg-orange-500/85";
    return "bg-red-600";
  }
  return (
    <Section
      eyebrow="05 — Reliability Surface R(k=1, ε, λ)"
      title="Chaos engineering for AI agents"
      subtitle={
        <>
          Methodology from{" "}
          <a
            href="https://arxiv.org/abs/2601.06112"
            className="underline hover:text-zinc-100"
            target="_blank"
            rel="noreferrer"
          >
            ReliabilityBench (arXiv 2601.06112)
          </a>
          . Pass@1 across input perturbation rate ε and fault injection rate λ. Per-agent live
          fault injection runs on demand from the per-agent page.
        </>
      }
    >
      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="mx-auto max-w-md">
          <div
            className="grid auto-rows-min"
            style={{ gridTemplateColumns: `4rem repeat(3, minmax(0, 1fr))` }}
          >
            <div></div>
            {[0, 0.3, 0.6].map((lam) => (
              <div
                key={lam}
                className="px-1 pb-1 text-center font-mono text-[10px] text-zinc-500"
              >
                λ = {lam.toFixed(1)}
              </div>
            ))}
            {[0, 0.2, 0.4].map((eps, i) => (
              <>
                <div
                  key={`eps-${eps}`}
                  className="flex items-center justify-end pr-2 font-mono text-[10px] text-zinc-500"
                >
                  ε = {eps.toFixed(1)}
                </div>
                {grid[i].map((c, j) => (
                  <div
                    key={`c-${i}-${j}`}
                    className={`m-0.5 flex h-12 items-center justify-center rounded-md ${color(c.p)}`}
                  >
                    <span className="font-mono text-sm font-bold tabular-nums text-white drop-shadow">
                      {c.p.toFixed(2)}
                    </span>
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-3">
          <Stat label="Grade" value="A · ≥ 0.85" color="text-emerald-300" />
          <Stat label="Live runner" value="rate-limit @ ε=0" color="text-zinc-200" />
          <Stat label="Trials per cell" value="6 (live) / 20 (computed)" color="text-zinc-200" />
        </div>
      </div>
    </Section>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-black/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className={`mt-1 font-mono text-sm font-semibold ${color ?? "text-zinc-200"}`}>
        {value}
      </div>
    </div>
  );
}

function SubstituteStrategy() {
  return (
    <Section
      eyebrow="06 — Substitute strategy"
      title="We attack the agent's declared surface, not the runtime"
      subtitle="Honest, scoped, and doesn't require per-framework adapters in week one."
    >
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">we use</div>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
              <li>· extracted system prompt</li>
              <li>· declared tool names</li>
              <li>· in-process memory</li>
              <li>· Qwen 2.5 7B as the base</li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">we don&apos;t</div>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
              <li>· boot real entrypoints</li>
              <li>· execute mocked tools</li>
              <li>· spam upstream maintainers</li>
              <li>· ship per-framework adapters (yet)</li>
            </ul>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-zinc-500">v2 roadmap</div>
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-400">
              <li>· LangChain runtime adapter</li>
              <li>· LangGraph adapter</li>
              <li>· CrewAI adapter</li>
              <li>· AutoGen adapter</li>
              <li>· MCP server adapter</li>
            </ul>
          </div>
        </div>
      </div>
    </Section>
  );
}

function AutoFixBundle() {
  const files = [
    { name: "system_prompt.patched.md", desc: "Original + Qwen-authored guards" },
    { name: "safety_contract.smt2", desc: "Z3 SMT source dump" },
    { name: "otel_config.yaml", desc: "OTel tailored to declared tools" },
    { name: "asi_compliance_tests.json", desc: "Replayable failed attacks" },
    { name: "REMEDIATION.md", desc: "Human-readable changelog" },
    { name: "pr_body.md", desc: "Pre-rendered PR description" },
    { name: "CERTIFICATE.pdf", desc: "Signed compliance certificate" },
    { name: "manifest.json", desc: "Machine-readable index" },
  ];
  return (
    <Section
      eyebrow="07 — Auto-fix bundle"
      title="The redemption arc"
      subtitle="For every failed attack across all live categories, the Remediation Agent hands the pattern back to Qwen 2.5 72B AWQ and asks for a category-specific defensive guard rule. Pre/post score validates the patch."
    >
      <div className="grid gap-2 md:grid-cols-2">
        {files.map((f) => (
          <div
            key={f.name}
            className="flex items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5"
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amd" />
            <div>
              <div className="font-mono text-xs text-zinc-200">{f.name}</div>
              <div className="text-[11px] text-zinc-500">{f.desc}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 max-w-2xl text-sm text-zinc-400">
        If the <code className="rounded bg-black/40 px-1 py-0.5 font-mono">gh</code> CLI is
        authenticated, the bundle is pushed to a fork in our namespace and a draft PR is opened
        against the fork&apos;s default branch.{" "}
        <span className="text-zinc-300">We never PR against upstream.</span>
      </p>
    </Section>
  );
}

function ComparisonTable() {
  const tools = ["AgentReady", "Promptfoo", "DeepEval", "Garak"];
  const rows: { feature: string; values: (string | true | "—")[] }[] = [
    {
      feature: "OWASP ASI-2026 native",
      values: [true, "—", "partial", "partial"],
    },
    { feature: "Multi-turn Crescendo", values: [true, "—", "—", "—"] },
    { feature: "Z3 SMT verification", values: [true, "—", "—", "—"] },
    { feature: "Reliability Surface R(k, ε, λ)", values: [true, "—", "—", "—"] },
    { feature: "Auto-fix PR + signed certificate", values: [true, "—", "—", "—"] },
    { feature: "Public ranked leaderboard", values: [true, "—", "—", "—"] },
    { feature: "x402 paid-tier (agentic payments)", values: [true, "—", "—", "—"] },
  ];
  return (
    <Section
      eyebrow="08 — Comparison vs incumbents"
      title="Different category, different output"
    >
      <div className="overflow-hidden rounded-2xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900/60 text-left text-[10px] uppercase tracking-[0.15em] text-zinc-500">
            <tr>
              <th className="px-4 py-3"></th>
              {tools.map((t) => (
                <th key={t} className="px-4 py-3 text-center">
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.map((r) => (
              <tr key={r.feature}>
                <td className="px-4 py-3 text-zinc-300">{r.feature}</td>
                {r.values.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-center">
                    {v === true ? (
                      <span className="inline-block rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-xs text-emerald-300">
                        ✓
                      </span>
                    ) : v === "—" ? (
                      <span className="text-zinc-600">—</span>
                    ) : (
                      <span className="text-xs text-yellow-400">{v}</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

function PricingTiers() {
  const tiers = [
    {
      name: "Basic",
      price: "$0.01",
      what: "Quality-at-Volume agent only.",
      includes: ["Single sample-pass", "Pass/fail under perturbation"],
    },
    {
      name: "Standard",
      price: "$0.10",
      what: "Full OWASP ASI-2026 + Reliability Surface.",
      includes: [
        "All 5 live ASI categories",
        "Stub indicators for the other 5",
        "R(k=1, ε, λ) chaos surface",
      ],
      featured: true,
    },
    {
      name: "Premium",
      price: "$1.00",
      what: "Adds Z3 + digital twin + auto-PR + signed certificate.",
      includes: [
        "Everything in Standard",
        "Z3 SMT verification",
        "Live fault injection",
        "Auto-PR + PDF certificate",
      ],
    },
  ];
  return (
    <Section
      eyebrow="09 — Pricing & unit economics"
      title="Three tiers, settled in USDC on Base via Coinbase x402"
      subtitle="Inference cost per scan ≈ $0.04 at AMD Developer Cloud spot rates. Standard tier ($0.10) leaves $0.06 margin. Famous-agent leaderboard runs free as a marketing flywheel."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={`rounded-2xl border p-6 transition-colors ${
              t.featured
                ? "border-amd/40 bg-gradient-to-br from-zinc-950 via-zinc-950 to-amd/10 hover:border-amd"
                : "border-zinc-800 bg-zinc-950 hover:border-zinc-700"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-base font-semibold tracking-tight">{t.name}</div>
              {t.featured ? (
                <span className="rounded-full bg-amd/20 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-amd">
                  popular
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="font-mono text-4xl font-bold tabular-nums text-zinc-100">
                {t.price}
              </span>
              <span className="text-xs text-zinc-500">USDC / scan</span>
            </div>
            <p className="mt-2 text-sm text-zinc-400">{t.what}</p>
            <ul className="mt-4 space-y-1.5 text-xs text-zinc-300">
              {t.includes.map((i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full bg-amd" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Disclosure() {
  return (
    <Section eyebrow="10 — Disclosure & limitations" title="What we publish, what we don't, what's broken">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-700/40 bg-emerald-950/15 p-5">
          <div className="text-[10px] uppercase tracking-wider text-emerald-300">we publish</div>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
            <li>· public leaderboard with named agents</li>
            <li>· methodology + every Z3 contract template</li>
            <li>· auto-PR diffs in our namespace</li>
            <li>· raw transcripts inside the maintainer&apos;s remediation bundle</li>
            <li>· trained LoRA weights on Hugging Face</li>
          </ul>
        </div>
        <div className="rounded-xl border border-amd/30 bg-amd/5 p-5">
          <div className="text-[10px] uppercase tracking-wider text-amd">honest limits</div>
          <ul className="mt-2 space-y-1.5 text-sm text-zinc-300">
            <li>· substitute model not real runtime</li>
            <li>· 5 of 10 ASI categories live (rest indicator)</li>
            <li>· 4 hand-written Z3 templates + 1 auto-formalized</li>
            <li>· chaos surface deterministic by default</li>
            <li>· 45 LoRA training samples (proof-of-loop, not production)</li>
          </ul>
        </div>
      </div>
    </Section>
  );
}

function Sources() {
  const sources = [
    {
      title: "OWASP Top 10 for Agentic Applications 2026",
      url: "https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/",
    },
    {
      title: "ReliabilityBench (arXiv 2601.06112)",
      url: "https://arxiv.org/abs/2601.06112",
    },
    {
      title: "substrate-guard / Emergent Formal Verification (arXiv 2603.21149)",
      url: "https://arxiv.org/abs/2603.21149",
    },
    {
      title: "DeepTeam OWASP_ASI_2026",
      url: "https://www.trydeepteam.com/docs/frameworks-owasp-top-10-for-agentic-applications",
    },
    {
      title: "Coinbase x402",
      url: "https://docs.cdp.coinbase.com/x402/welcome",
    },
    {
      title: "AgentReady on GitHub",
      url: "https://github.com/vaatus/agentready",
    },
  ];
  return (
    <Section eyebrow="11 — Sources" title="Standards, papers, and adjacent work we cite">
      <div className="grid gap-2 md:grid-cols-2">
        {sources.map((s) => (
          <a
            key={s.url}
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 transition-all hover:border-amd hover:bg-amd/5"
          >
            <span className="text-sm text-zinc-300">{s.title}</span>
            <span className="text-xs text-zinc-500">↗</span>
          </a>
        ))}
      </div>
    </Section>
  );
}

function Section({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5">
        <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-500">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">{title}</h2>
        {subtitle ? <p className="mt-2 max-w-3xl text-sm text-zinc-400">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
