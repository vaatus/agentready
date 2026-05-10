# AgentReady

> **The public adversarial benchmark for AI agents.** We scan every famous open-source AI agent against OWASP ASI-2026, name the failures, then auto-fix them with formal verification, chaos engineering, and a real GitHub PR. Powered by AMD MI300X.

[![Leaderboard](https://img.shields.io/badge/leaderboard-13%20agents%20tested-blue)](https://vaatus.github.io/agentready/leaderboard.html) [![Methodology](https://img.shields.io/badge/methodology-vaatus.github.io-blue)](https://vaatus.github.io/agentready/methodology.html) [![HF Space](https://img.shields.io/badge/🤗-Interactive%20Dashboard-yellow)](https://huggingface.co/spaces/vaatus/agentready-judge-demo) [![HF LoRA](https://img.shields.io/badge/🤗-Chaos%20LoRA-yellow)](https://huggingface.co/vaatus/agentready-chaos-remediation-lora-v0) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![AMD MI300X](https://img.shields.io/badge/Powered%20by-AMD%20MI300X-ED1C24)](https://www.amd.com/en/developer.html)

AMD Developer Hackathon submission · [lablab.ai](https://lablab.ai/ai-hackathons/amd-developer) · May 2026

![Leaderboard hero](docs/screenshots/cover.png)

![Architecture](docs/screenshots/architecture.png)

---

## Live artifacts

| What | Where |
|---|---|
| Methodology (long-form) | https://vaatus.github.io/agentready/methodology.html |
| Project landing | https://vaatus.github.io/agentready/ |
| Methodology doc (markdown) | [docs/OWASP_ASI_COMPLIANCE.md](docs/OWASP_ASI_COMPLIANCE.md) |
| Judge LLM Space (HF) | https://huggingface.co/spaces/vaatus/agentready-judge-demo |
| Chaos-remediation LoRA (HF) | https://huggingface.co/vaatus/agentready-chaos-remediation-lora-v0 |
| Real auto-PR (BabyAGI) | https://github.com/vaatus/babyagi/pull/1 |
| Embeddable badge | [Codecov-style SVG endpoint](#embeddable-badge) — drop into your README |

## Embeddable badge

Show your agent's OWASP ASI-2026 score on your README:

```markdown
[![OWASP ASI-2026](http://134.199.203.147:8002/agent/your-slug/badge.svg)](http://134.199.203.147:3000/agent/your-slug)
```

Color-coded: emerald for ≥85, yellow-gold for 70-84, gold for 55-69, red for <55. Refreshes on every re-scan.

The full stack — the FastAPI backend, the Next.js frontend, and the Qwen 2.5 7B Judge served via vLLM 0.17 / ROCm 7.2 — runs on a single AMD Instinct MI300X via the AMD Developer Cloud, with ~95 GB of 192 GB VRAM in use.

---

## What it does

Submit any AI agent's GitHub repo and AgentReady returns:

1. **A position on the public leaderboard** — ranked against every famous open-source AI agent (Aider, Open Interpreter, AutoGPT, BabyAGI, Claude Engineer, GPT-Engineer, AutoGen, CrewAI, LangGraph, AgentGPT) on OWASP ASI-2026.
2. **An OWASP ASI-2026 compliance scorecard** with 0-100 scores across all 10 agentic risk categories. ASI06 (Memory Poisoning) runs live against the agent's reconstructed prompt + tool surface; the other 9 are manifest-aware indicators.
3. **A chaos resilience grade** A-F from the Reliability Surface R(k=1, ε, λ) — pass@1 under input perturbation rate ε and fault injection rate λ. Methodology from [ReliabilityBench (arXiv 2601.06112)](https://arxiv.org/abs/2601.06112).
4. **A formal verification report** from Z3 SMT — VERIFIED, or VIOLATION with a concrete counterexample. Contracts pattern-matched from the agent manifest.
5. **An auto-generated GitHub PR** opened against a fork in our namespace, containing: patched system prompt with Qwen-authored defensive guard rules, Z3 safety contract, OpenTelemetry config, replayable ASI06 test JSON, and a signed PDF compliance certificate. The redemption arc.
6. **An x402 paid-tier flow** at $0.01 / $0.10 / $1.00 in USDC on Base.

![Per-agent report](docs/screenshots/agent-babyagi.png)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ INPUT: Public leaderboard (pre-scored) | User-submitted repo  │
└──────────────────────────────┬─────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ INGEST                                                         │
│ Clone repo • detect framework • extract tools/prompt/memory    │
└──────────────────────────────┬─────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ EVALUATION ORCHESTRATOR — AMD MI300X (192 GB VRAM)             │
│                                                                │
│  Quality       Red Team         Verification                   │
│  (parallel)    (OWASP ASI06     (Z3 SMT contract               │
│                 + 9 indicators)  templates)                    │
│                                                                │
│  Chaos         Substitute       Remediation                    │
│  (R(k,ε,λ))    Session          (Qwen-authored guards          │
│                                  → real GitHub PR)             │
│                                                                │
│  Judge: Qwen 2.5 7B Instruct via vLLM 0.17 / ROCm 7.2.          │
│  Red:   Qwen 2.5 7B Instruct (same backend, separate role).    │
│  Production target: 70B Judge + 7B Red + target model          │
│  concurrent in 192 GB — impossible on a single 80 GB H100.     │
└──────────────────────────────┬─────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ SCORER → public leaderboard at agentready.dev                  │
│ REMEDIATION → auto-fix bundle + draft PR on a fork             │
│ x402 → paid premium tier with on-chain settlement (Base)       │
└────────────────────────────────────────────────────────────────┘
```

---

## Tracks targeted

- **AI Agents & Agentic Workflows** (primary) — multi-agent OWASP ASI scanner with Z3-verified safety contracts
- **Domain-Specific Fine-Tunes** — Qwen 2.5 7B base + chaos-remediation LoRA adapter (Hugging Face)
- **x402 Challenge** — `POST /x402/scan/{tier}` returns the 402 challenge, settles via Coinbase facilitator on Base

Sponsor checkboxes hit:
- **AMD MI300X** — every Judge + Red call serves from MI300X
- **Hugging Face** — Judge demo Space + chaos LoRA model repo published
- **Qwen** — Qwen 2.5 7B is both the Judge and the LoRA fine-tune base
- **MindsDB** — backs the digital-twin helpdesk data layer (`/twins/helpdesk/*`)
- **Akash Network** — `infra/akash-deploy.yaml` + Dockerfile + `infra/deploy.sh`
- **x402 (Coinbase)** — `/x402/tiers` + `/x402/scan/{tier}`

---

## Quick start (local)

### Prerequisites
- Python 3.11+ (3.13 tested)
- Node 20+
- Docker + Docker Compose (optional — defaults to SQLite)
- For the real Judge: AMD MI300X via [AMD Developer Cloud](https://www.amd.com/en/developer.html). Otherwise use `JUDGE_MODE=stub` for a deterministic offline heuristic.

### Setup
```bash
git clone https://github.com/vaatus/agentready.git
cd agentready
python3.13 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]" && pip install aiosqlite greenlet
cp .env.example .env       # then fill HF_TOKEN, GITHUB_TOKEN as needed
cd apps/web && pnpm install && cd ../..
```

### Run (stub-judge mode — no MI300X required)
```bash
echo 'POSTGRES_URL=sqlite+aiosqlite:///./agentready.db' >> .env
echo 'JUDGE_MODE=stub' >> .env

python -m apps.api.cli seed-leaderboard
uvicorn apps.api.main:app --port 8000 &
cd apps/web && AGENTREADY_API_URL=http://localhost:8000 pnpm dev
```

Open http://localhost:3000.

### Run a real scan against a repo
```bash
python -m apps.api.cli scan https://github.com/yoheinakajima/babyagi --slug babyagi
```

### Trigger an auto-fix PR
```bash
curl -X POST http://localhost:8000/agent/babyagi/remediate
```

When `gh` CLI is authenticated, the bundle is also pushed to a fork in your namespace and a draft PR is opened automatically (see [vaatus/babyagi#1](https://github.com/vaatus/babyagi/pull/1) for the demo example).

### Switch the Judge to MI300X-hosted vLLM
```bash
echo 'JUDGE_MODE=vllm' >> .env
echo 'JUDGE_LLM_URL=http://your-mi300x-host:8001/v1' >> .env
echo 'RED_LLM_URL=http://your-mi300x-host:8001/v1' >> .env
```

---

## Production deploy on the same MI300X

`infra/docker-compose.deploy.yml` co-hosts the FastAPI backend and Next.js frontend on the MI300X instance that's already serving the Judge LLM, on the host network. Rsync + compose:

```bash
rsync -az --exclude '.venv' --exclude 'node_modules' --exclude '.git' \
  ./ root@<MI300X-IP>:/root/agentready/

ssh root@<MI300X-IP> 'cd /root/agentready && \
  HF_TOKEN=hf_... PUBLIC_HOST=<MI300X-IP> \
  docker compose -f infra/docker-compose.deploy.yml up -d --build'
```

---

## Repository layout

| Path | What it does |
|---|---|
| `apps/api/` | FastAPI backend — routes, orchestrator, DB models, CLI |
| `apps/web/` | Next.js 14 frontend — leaderboard, per-agent reports, methodology |
| `agents/` | LLM clients, substitute target session, remediation, GitHub PR opener |
| `owasp_asi/` | ASI06 memory poisoning attack suite + manifest-aware stub scores |
| `chaos/` | Reliability surface + rate-limit fault injector |
| `verification/` | Z3 contract templates + PDF certificate generator |
| `digital_twins/` | MindsDB-backed helpdesk twin |
| `leaderboard/` | Famous agents seed + batch runner |
| `infra/` | Dockerfiles + Akash SDL + production compose |
| `scripts/` | Hugging Face publish scripts (LoRA + Space) |

---

## Key references

- [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) — Dec 2025 standard, 10 risk categories ASI01–ASI10
- [ReliabilityBench (arXiv 2601.06112)](https://arxiv.org/abs/2601.06112) — Reliability Surface R(k, ε, λ), chaos eval methodology
- [VERGE (arXiv 2601.20055)](https://arxiv.org/html/2601.20055v2) — Z3 SMT for verified LLM reasoning
- [Emergent Formal Verification / substrate-guard (arXiv 2603.21149)](https://arxiv.org/abs/2603.21149)
- [DeepTeam OWASP ASI framework](https://www.trydeepteam.com/docs/frameworks-owasp-top-10-for-agentic-applications)
- [Coinbase x402](https://docs.cdp.coinbase.com/x402/welcome)

---

## License

MIT — see [LICENSE](./LICENSE).
