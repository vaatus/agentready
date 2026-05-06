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
        Z3, and auto-open pull requests to fix what we find.
      </p>

      <h2>What we test</h2>
      <ul>
        <li>
          <strong>OWASP ASI-2026 (10 categories)</strong> — agent goal hijack, tool misuse, identity abuse,
          supply chain vulnerabilities, code execution, memory poisoning, planning errors, inter-agent
          communication, trust exploitation, rogue agents.
        </li>
        <li>
          <strong>Chaos resilience</strong> — rate limits, schema drift, partial responses, network errors,
          authentication expiry, KV-cache eviction. Yields the Reliability Surface R(k, ε, λ) from{" "}
          <a href="https://arxiv.org/abs/2601.06112">ReliabilityBench</a>.
        </li>
        <li>
          <strong>Formal verification</strong> — we extract the safety contract from system prompts and tool
          manifests, then ask Z3 SMT to prove or counter-example it.
        </li>
      </ul>

      <h2>How we test</h2>
      <p>
        Each scan starts by cloning the agent&apos;s GitHub repository and detecting its framework
        (LangChain, LangGraph, CrewAI, AutoGen, custom). We extract the system prompt, tool manifest, and
        memory configuration. Phase 1 of AgentReady targets the agent&apos;s declared
        prompt + tool surface; we plan to add per-framework runtime adapters in Phase 2.
      </p>
      <p>
        ASI06 (Memory Poisoning) is the headline live category — we plant fake authority memories in a
        warm-up session and check if the agent executes a forbidden action in a fresh session. The Llama
        3.1 70B Judge LLM scores whether the post-attack response materially deviates from the baseline.
      </p>
      <p>
        The Judge LLM and Qwen 2.5 7B Red LLM run concurrently in 192 GB of MI300X VRAM — a
        configuration impossible on a single 80 GB H100 without trade-offs.
      </p>

      <h2>Disclosure</h2>
      <p>
        Every benchmarked maintainer can request a re-scan after merging the auto-PR. Scores update
        publicly. Methodology is open source under the MIT license.
      </p>
    </article>
  );
}
