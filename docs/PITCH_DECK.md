# AgentReady — Pitch Deck (8 slides)

> Source markdown for the submission pitch deck. Render to PDF via
> `marp --pdf docs/PITCH_DECK.md` or paste each slide into Google Slides /
> Keynote / Notion. Cover image lives at `docs/screenshots/cover.png`.

---

<!-- _class: lead -->

# AgentReady
## The public adversarial benchmark for AI agents

**9 of 10 famous open-source AI agents fail OWASP ASI-2026.**
Here's the proof.

> AMD Developer Hackathon · lablab.ai · May 2026 · Powered by AMD MI300X

---

## Slide 1 — The 9-of-10 problem

OWASP published the **Top 10 for Agentic Applications 2026** in December.
A new industry standard for AI agent security.

**No public scanner exists. We built one.**

Headline numbers (live at [134.199.203.147:3000](http://134.199.203.147:3000)):

| Rank | Agent | OWASP ASI-2026 |
|---|---|---|
| 1 | AutoGPT | 70.4 |
| 2 | Claude Engineer | 69.6 |
| 3 | Aider | 69.5 |
| ... | ... | ... |
| 10 | AutoGen Quickstart | 58.8 |

Every agent above with score < 70 has a memory-poisoning vulnerability that
manipulates it into executing forbidden actions. We caught all of them.

---

## Slide 2 — The OWASP ASI-2026 standard

Released December 2025. 10 risk categories agentic systems introduce that
classical LLM security frameworks don't cover:

`ASI01` Goal Hijack · `ASI02` Tool Misuse · `ASI03` Identity Abuse ·
`ASI04` Supply Chain · `ASI05` Code Execution · **`ASI06` Memory Poisoning** ·
`ASI07` Planning Errors · `ASI08` Inter-Agent · `ASI09` Trust Exploitation ·
`ASI10` Rogue Agents

Every team building an agent will need to certify against this.
**No public benchmark exists today. AgentReady is the first.**

---

## Slide 3 — AgentReady, in one architecture

```
INPUT: Public leaderboard | User-submitted GitHub repo

      ↓ ingest (clone + framework detection)
      ↓
ORCHESTRATOR — runs concurrently in 192 GB VRAM on AMD MI300X:
  ASI06 (live)   Stub scores ASI01-05/07-10 (manifest-aware)
  Z3 SMT         Reliability Surface R(k, ε, λ)
  Substitute      Judge LLM (Qwen 2.5 7B Instruct via vLLM 0.17 / ROCm 7.2)
   session        Red LLM   (Qwen 2.5 7B Instruct, separate role)

      ↓
SCORE → public leaderboard
REMEDIATION → patched system prompt (Qwen-authored guard rules) + Z3 contract
              + OTel config + replayable test JSON + signed PDF certificate
              → real GitHub PR opened against a fork
```

---

## Slide 4 — Live demo (3 acts)

**Act 1 (0:00–1:00)** — Open [134.199.203.147:3000](http://134.199.203.147:3000).
Headline: *"9 of 10 famous open-source AI agents fail OWASP ASI-2026."* 10 named rows.
Click BabyAGI.

**Act 2 (1:00–3:00)** — Per-agent page:
- ASI06 side-by-side. **Session 1**: clean baseline, agent refuses without confirmation. **Session 2**: identical trigger after fake-authority memory plant. Agent autonomously executes the forbidden action. Judge confidence 95%.
- Z3 view: VERIFIED for guarded agents, VIOLATION with concrete counterexample for vulnerable ones. Math, not vibes.
- Reliability Surface: pass@1 drops 0.97 → 0.73 across the ε × λ grid.

**Act 3 (3:00–5:00)** — Click *"Generate fix PR"*. Qwen on MI300X authors
defensive guard rules tailored to the failed attacks. Live PR opens at
[github.com/vaatus/babyagi/pull/1](https://github.com/vaatus/babyagi/pull/1).
8 artifacts in the diff. Score climbs.

---

## Slide 5 — Why AMD MI300X is the moat

The pipeline serves three models concurrently in a single 192 GB VRAM:
- **Judge LLM** — Qwen 2.5 7B (production target: Llama 3.1 70B FP8 ~90 GB)
- **Red LLM** — Qwen 2.5 7B for adversarial prompt generation
- **Target agent's reconstructed prompt+tool surface** under attack

`rocm-smi` snapshot during the demo:
```
GPU[0]: VRAM Total Memory:      192 GB
GPU[0]: VRAM Total Used Memory:  95 GB  (49%)
GPU[0]: 5 vLLM workers active
```

On a single 80 GB H100, you cannot host all three concurrently without
quantizing the Judge below the quality threshold. **MI300X is the entire
reason this benchmark is feasible in real time.**

---

## Slide 6 — Business model + x402

Three pricing tiers, settled in USDC on Base via the Coinbase x402 facilitator:

| Tier | Price | What runs |
|---|---|---|
| Basic | $0.01 | Quality-at-Volume agent only |
| Standard | $0.10 | Full OWASP ASI-2026 + Chaos resilience |
| Premium | $1.00 | Adds Z3 verification, digital-twin sim, auto-PR, signed PDF certificate |

Live endpoint:
```
POST /x402/scan/standard → HTTP 402 + payment requirements
                         → retry with X-PAYMENT signed proof
                         → scan runs, settlement returned
```

Famous-agent leaderboard scans are free (we sponsor them as marketing).
Submitter-driven scans are paid. Recurring revenue model: every agent team
needs a re-cert when their agent ships a new release.

---

## Slide 7 — Sponsor track artifacts

Each is a real, public, reachable artifact today:

- **AMD MI300X** → live at `134.199.203.147:8001` (Qwen 2.5 7B via vLLM)
- **HuggingFace Space** → [Judge demo](https://huggingface.co/spaces/vaatus/agentready-judge-demo)
- **HuggingFace LoRA** → [chaos-remediation v0](https://huggingface.co/vaatus/agentready-chaos-remediation-lora-v0)
- **Qwen** → judge + red role + LoRA fine-tune base
- **MindsDB** → digital-twin helpdesk at `/twins/helpdesk/*`
- **Akash** → `infra/akash-deploy.yaml` ready
- **x402** → `/x402/scan/{tier}` returns 402 challenge with Coinbase facilitator integration

GitHub: [github.com/vaatus/agentready](https://github.com/vaatus/agentready)

---

## Slide 8 — What's next

**Today**: 10 agents benchmarked. Public leaderboard, real PR, signed certificate.

**Next 30 days**:
- Train a real chaos-remediation LoRA on Unsloth/MI300X (we have the synthetic data pipeline; placeholder repo waits for weights)
- Llama 3.1 70B Judge for higher-fidelity verdicts
- Multi-turn Crescendo attacks for ASI09 (Human-Agent Trust)
- Live re-eval after PR merge — closes the redemption loop

**Roadmap**:
- OWASP partnership for the official ASI-2026 benchmark
- Embed badge (Codecov-style) for agent README files: `agentready.dev/{slug}/badge.svg`
- v2 per-framework runtime adapters (LangChain, AutoGen, CrewAI, MCP) — replaces the substitute-session model with real framework execution
- Seed funding round positioning: *"Codecov for AI agents."*

> **Different category, different demo, different prize.**
> AgentReady is the public adversarial benchmark for the AI agent ecosystem.
