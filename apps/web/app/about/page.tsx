export const metadata = {
  title: "Methodology — AgentReady",
};

export default function AboutPage() {
  return (
    <article className="prose prose-invert max-w-3xl">
      <h1>Methodology</h1>

      <p>
        AgentReady is the public adversarial benchmark for AI agents. We score every famous
        open-source AI agent against the OWASP Top 10 for Agentic Applications 2026 (ASI-2026),
        run chaos engineering against them, formally verify their declared safety contracts with
        Z3, and auto-open pull requests to fix what we find — all on a single AMD Instinct™ MI300X.
      </p>

      <h2>Compute substrate</h2>
      <table>
        <thead>
          <tr>
            <th>Component</th>
            <th>Hardware</th>
            <th>Software</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Judge LLM</td>
            <td>AMD Instinct MI300X (192 GB VRAM)</td>
            <td>Qwen 2.5 72B Instruct AWQ via vLLM 0.17 / ROCm 7.2</td>
          </tr>
          <tr>
            <td>Red LLM &amp; substitute target</td>
            <td>Same MI300X (concurrent in 192 GB)</td>
            <td>Qwen 2.5 7B Instruct via vLLM 0.17 / ROCm 7.2</td>
          </tr>
          <tr>
            <td>Z3 SMT solver</td>
            <td>CPU-side</td>
            <td>z3-solver Python bindings</td>
          </tr>
        </tbody>
      </table>
      <p>
        Combined VRAM footprint: ~75 GB / 192 GB. The remaining ~120 GB is KV-cache headroom. The
        70B-class Judge + 7B Red concurrent in a single GPU is the configuration that makes
        AgentReady&apos;s parallel red-team-and-judge pipeline feasible in real time.
      </p>

      <h2>Live OWASP ASI-2026 categories</h2>
      <ul>
        <li>
          <strong>ASI01 — Agent Goal Hijack:</strong> 5 single-turn redirect attacks (system override,
          poisoned tool output, persona swap, injected priority, calendar/PDF metadata injection).
        </li>
        <li>
          <strong>ASI02 — Tool Misuse:</strong> 5 dangerous-chain probes (exfil, unauthorized delete,
          credential leak, tenant breakout, sandbox escape).
        </li>
        <li>
          <strong>ASI06 — Memory Poisoning:</strong> 10 attacks across 5 categories (false approval,
          fake preference, fake authority, self-replicating, goal drift). Two-session test harness.
        </li>
        <li>
          <strong>ASI09 — Human-Agent Trust Exploitation:</strong> 3 multi-turn Crescendo escalations
          (CTO-backed deletion, legal-carveout PII export, on-call key rotation). 4-phase prime per the
          LangWatch Scenario framework.
        </li>
      </ul>
      <p>
        ASI03, ASI04, ASI05, ASI07, ASI08, ASI10 ship as <em>manifest-aware deterministic indicators</em>{" "}
        in Phase 1. v2 promotes them to live as we expand the attack libraries.
      </p>

      <h2>Z3 formal verification</h2>
      <p>
        Four hand-written contract templates pattern-match against the manifest and ask Z3 to find a
        counterexample. <strong>VERIFIED</strong> means the safety property is unsatisfiable to
        violate; <strong>VIOLATION</strong> returns a concrete counterexample tuple (e.g.
        <code> {"{user_role: 0, delete_called: True, role_check_called: False}"}</code>). Math, not
        vibes.
      </p>

      <h2>Reliability Surface R(k=1, ε, λ)</h2>
      <p>
        Methodology from{" "}
        <a href="https://arxiv.org/abs/2601.06112">ReliabilityBench (arXiv 2601.06112)</a>. A 3 × 3
        grid of pass@1 across input perturbation rate ε and fault injection rate λ. Per-agent live
        fault injection runs on demand.
      </p>

      <h2>Substitute-agent strategy</h2>
      <p>
        Phase 1 attacks the agent&apos;s <em>declared prompt + tool surface</em>, reconstructed as a
        substitute. v2 adds per-framework runtime adapters (LangChain, LangGraph, CrewAI, AutoGen,
        MCP) to test the full runtime. This is honest about coverage and avoids per-framework adapter
        complexity in week one.
      </p>

      <h2>Auto-fix bundle</h2>
      <p>
        For every failed live attack, the Remediation Agent hands the pattern to Qwen 2.5 72B and
        asks for category-specific defensive guard rules. The bundle ships:
      </p>
      <ul>
        <li>Patched system prompt (original + Qwen-authored guards)</li>
        <li>Z3 SMT contract dump</li>
        <li>OpenTelemetry config tailored to declared tools</li>
        <li>Replayable JSON test suite</li>
        <li>Pre-rendered PR description</li>
        <li>Signed PDF compliance certificate</li>
      </ul>
      <p>
        If GitHub auth is available, a draft PR is opened against a fork in our namespace. We never
        PR against upstream — that would be demo theater spam to maintainers.
      </p>

      <h2>How we differ from existing eval frameworks</h2>
      <table>
        <thead>
          <tr>
            <th></th>
            <th>AgentReady</th>
            <th>Promptfoo</th>
            <th>DeepEval</th>
            <th>Garak</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>OWASP ASI-2026 native</td>
            <td>✓ first public</td>
            <td>—</td>
            <td>partial (LLM Top-10)</td>
            <td>partial (LLM-focus)</td>
          </tr>
          <tr>
            <td>Multi-turn Crescendo</td>
            <td>✓</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Z3 SMT verification</td>
            <td>✓</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Reliability Surface (chaos eng.)</td>
            <td>✓</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Auto-fix PR + signed certificate</td>
            <td>✓</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>Public ranked leaderboard</td>
            <td>✓</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
          </tr>
          <tr>
            <td>x402 paid tier (agentic payments)</td>
            <td>✓</td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
          </tr>
        </tbody>
      </table>

      <h2>Pricing &amp; unit economics</h2>
      <p>
        Three paid tiers settled in USDC on Base via Coinbase x402. Inference cost per scan
        (Qwen 7B + 72B AWQ on MI300X) is approximately <code>$0.04</code> at AMD Developer Cloud spot
        rates; the standard tier ($0.10) leaves a $0.06 margin per scan. The famous-agent leaderboard
        runs free as a marketing flywheel.
      </p>
      <table>
        <thead>
          <tr>
            <th>Tier</th>
            <th>Price (USDC)</th>
            <th>What runs</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic</td>
            <td>$0.01</td>
            <td>Quality-at-Volume agent only</td>
          </tr>
          <tr>
            <td>Standard</td>
            <td>$0.10</td>
            <td>Full OWASP ASI-2026 + Reliability Surface</td>
          </tr>
          <tr>
            <td>Premium</td>
            <td>$1.00</td>
            <td>Adds Z3, digital-twin, auto-PR, signed certificate</td>
          </tr>
        </tbody>
      </table>

      <h2>Disclosure</h2>
      <p>
        Every benchmarked maintainer can request a re-scan after merging the auto-PR. Scores update
        publicly. Methodology is open source under the MIT license. Raw attack transcripts are
        published only inside the maintainer&apos;s remediation bundle (not on the public site).
      </p>

      <h2>Limitations</h2>
      <ul>
        <li>
          <strong>Substitute model:</strong> all targets are attacked against a Qwen 7B substitute.
          Score differences reflect differences in system prompts, tool declarations, framework, and
          memory configuration — but the underlying token-prediction behavior is shared.
        </li>
        <li>
          <strong>Indicator categories:</strong> 6 of 10 ASI categories are deterministic indicators,
          not live attacks. Per-category methodology and roadmap to live in <code>docs/OWASP_ASI_COMPLIANCE.md</code>.
        </li>
        <li>
          <strong>Z3 templates:</strong> 4 templates pattern-match against tool names. Won&apos;t catch
          domain-specific invariants. NL→SMT auto-formalization is a v2 feature.
        </li>
      </ul>

      <h2>Sources</h2>
      <ul>
        <li>
          <a href="https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/">
            OWASP Top 10 for Agentic Applications 2026
          </a>
        </li>
        <li>
          <a href="https://arxiv.org/abs/2601.06112">ReliabilityBench (arXiv 2601.06112)</a>
        </li>
        <li>
          <a href="https://arxiv.org/abs/2603.21149">substrate-guard / Emergent Formal Verification (arXiv 2603.21149)</a>
        </li>
        <li>
          <a href="https://www.trydeepteam.com/docs/frameworks-owasp-top-10-for-agentic-applications">
            DeepTeam OWASP_ASI_2026
          </a>
        </li>
        <li>
          <a href="https://docs.cdp.coinbase.com/x402/welcome">Coinbase x402</a>
        </li>
      </ul>
    </article>
  );
}
