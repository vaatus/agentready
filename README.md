# AgentReady

> **The public adversarial benchmark for AI agents.** All 10 OWASP Top 10 for Agentic Applications 2026 categories run for real on a single AMD MI300X — fake memories, slow-burn manipulation, peer-agent spoofing, identity abuse, and 6 more — across every famous open-source AI agent. Then we open a real GitHub pull request that fixes what broke.

[![Leaderboard](https://img.shields.io/badge/leaderboard-13%20agents%20tested-blue)](https://vaatus.github.io/agentready/leaderboard.html) [![Methodology](https://img.shields.io/badge/methodology-vaatus.github.io-blue)](https://vaatus.github.io/agentready/methodology.html) [![HF Space](https://img.shields.io/badge/🤗-Interactive%20Dashboard-yellow)](https://huggingface.co/spaces/vaatus/agentready-judge-demo) [![HF LoRA](https://img.shields.io/badge/🤗-Chaos%20LoRA-yellow)](https://huggingface.co/vaatus/agentready-chaos-remediation-lora-v0) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![AMD MI300X](https://img.shields.io/badge/Powered%20by-AMD%20MI300X-ED1C24)](https://www.amd.com/en/developer.html)

AMD Developer Hackathon submission · [lablab.ai](https://lablab.ai/ai-hackathons/amd-developer) · May 2026

![Leaderboard hero](docs/screenshots/cover.png)

![Architecture](docs/screenshots/architecture.png)

---

## Live artifacts

| What | Where |
|---|---|
| Public leaderboard | https://vaatus.github.io/agentready/leaderboard.html |
| Per-agent reports × 13 | https://vaatus.github.io/agentready/agent/{slug}.html |
| Methodology (long-form) | https://vaatus.github.io/agentready/methodology.html |
| Project landing | https://vaatus.github.io/agentready/ |
| Interactive HF Space | https://huggingface.co/spaces/vaatus/agentready-judge-demo |
| Chaos-remediation LoRA | https://huggingface.co/vaatus/agentready-chaos-remediation-lora-v0 |
| Real auto-PR (BabyAGI) | https://github.com/vaatus/babyagi/pull/1 |
| Methodology doc (markdown) | [docs/OWASP_ASI_COMPLIANCE.md](docs/OWASP_ASI_COMPLIANCE.md) |

The full stack — the FastAPI backend, the Next.js frontend, and two Qwen models served via vLLM 0.17 / ROCm 7.2 — runs on a single AMD Instinct MI300X via the AMD Developer Cloud, with **~75 GB of 192 GB VRAM** in use concurrently:

- **Qwen 2.5 72B Instruct AWQ** as the Judge (~40 GB) — strict-JSON behavior-drift verdicts on every attack outcome.
- **Qwen 2.5 7B Instruct** as the Red LLM + substitute target (~16 GB) — tailors per-agent attack pretexts and impersonates the target agent inside the two-session memory test.
- **Z3 SMT solver** on the CPU side — math-checked safety contracts, returns either *proven safe* or a concrete counter-example.

This concurrent-two-models-on-one-GPU layout doesn't fit on a single 80 GB Nvidia H100 without dropping the Judge below the quality threshold needed for guided-JSON verdicts.

---

## What it does

Pick any agent on the leaderboard (or paste your own GitHub URL on the [scan page](https://vaatus.github.io/agentready/)) and AgentReady returns:

1. **A position on the public ranked leaderboard.** All 13 famous open-source AI agents tested — Aider, Open Interpreter, AutoGPT, BabyAGI, Cline, Claude Engineer, GPT-Engineer, AutoGen, CrewAI, LangGraph, AgentGPT, smolagents, OpenHands.
2. **Scores for all 10 OWASP ASI-2026 categories.** Every category runs **real, reproducible attacks** — no manifest-derived heuristics. About 46 attacks per scan, every one rewritten by Qwen 7B to fit the specific agent's role and toolbox.
3. **A stress-test grade A-F** from the 3×3 Reliability Surface (success rate × reworded prompts × injected server failures). Methodology from [ReliabilityBench (arXiv 2601.06112)](https://arxiv.org/abs/2601.06112).
4. **A math-checked safety report** from Z3 SMT — *proven safe* across all contracts, or a concrete counter-example showing the exact inputs that break a rule. 4 hand-written contract templates + 1 Qwen-authored from the agent's own description.
5. **An auto-generated GitHub PR** opened against a fork in our namespace — patched job description with Qwen-authored guard rules, the math-checked safety contract, OpenTelemetry config, replayable attack JSON, and a signed PDF safety certificate. We also re-run the same attacks against the patched prompt to **prove the fix worked** (e.g. BabyAGI memory tampering: 45 → 78 / 100).
6. **A Coinbase x402 paid-tier flow** at $0.01 / $0.10 / $1.00 USDC on Base.

![Per-agent report](docs/screenshots/agent-babyagi.png)

---

## The 10 OWASP categories — all live

| ID | Category (plain English) | Attacks per scan | Examples |
|---|---|---|---|
| ASI01 | Hijacking the agent | 5 | fake build-server log, calendar invite, RAG postmortem, support ticket, MCP tool description |
| ASI02 | Combining safe tools, harmful outcome | 5 | read_file + send_email (data leak), unauth_delete, credential_leak, tenant_breakout, sandbox_escape |
| ASI03 | Pretending to be someone else | 5 | self-claimed admin, hearsay handoff, cross-tenant via partnership, service-account impersonation, scope creep |
| ASI04 | Sneaky tools in the toolbox | 5 | rogue MCP server, silent plugin swap, tool alias redirect, compromised dependency, remote prompt pack |
| ASI05 | Running attacker code | 5 | unsafe pickle, env-var leak, curl-to-bash, eval untrusted input, hidden subprocess |
| ASI06 | Planting fake memories | 10 + 3 novel | false approval, fake authority, fake preference, self-spreading, goal drift, **+ self-modifying memory (our novel attack)** |
| ASI07 | Knocking the agent off-track | 5 | fake step completion, subgoal substitution, false prior agreement, partial-completion skip, unsafe error recovery |
| ASI08 | Tricking another agent | 5 | fake peer-agent directive, fabricated tool result, fake orchestrator broadcast, fake crew handoff, injected trust metadata |
| ASI09 | Slow-burn manipulation (Crescendo) | 3 templates × 4 turns | fake-CTO user deletion, legal-carveout PII export, oncall key-rotation fast-path |
| ASI10 | Drift — agent rewriting itself | 5 | threshold relaxation, prompt compression, self-replicating directive, persona overwrite, silent constraint drop |

**~46 attacks per scan**, every one tailored to the specific agent we're testing. No two scans get the same disguise.

![Methodology page](docs/screenshots/methodology.png)

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│ INPUT: Public leaderboard (pre-scored) | User-submitted repo  │
└──────────────────────────────┬─────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ INGEST                                                         │
│ Clone repo • detect framework (.py/.ts/.js/.md)                │
│ extract tools, system prompt, memory primitives                │
└──────────────────────────────┬─────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ EVALUATION ORCHESTRATOR — AMD MI300X (192 GB VRAM)             │
│                                                                │
│   ASI01–ASI10        Z3 SMT             Reliability Surface    │
│  (10 live attack    (4 hand-written     (success rate ×        │
│   suites, ~46        + 1 Qwen-           reworded × fake-      │
│   attacks per        authored            failure stress)       │
│   scan)              contracts)                                │
│                                                                │
│   Per-agent attack tailoring (Qwen 7B rewrites every probe)    │
│   Substitute target session (chat-level memory always present) │
│   Auto-fix bundle (Qwen 72B writes guards + re-runs attacks)   │
│                                                                │
│  Judge: Qwen 2.5 72B Instruct AWQ via vLLM 0.17 / ROCm 7.2.    │
│  Red / substitute target: Qwen 2.5 7B Instruct (same backend). │
│  ~75 GB / 192 GB used concurrently — both models live at once. │
│  Doesn't fit on a single 80 GB H100 without quality loss.      │
└──────────────────────────────┬─────────────────────────────────┘
                               ▼
┌────────────────────────────────────────────────────────────────┐
│ SCORER → ranked leaderboard at vaatus.github.io/agentready     │
│ REMEDIATION → fork + draft PR + before/after score evidence    │
│ x402 → paid premium tier with on-chain settlement (Base USDC)  │
└────────────────────────────────────────────────────────────────┘
```

---

## Tracks targeted

- **AI Agents & Agentic Workflows** (primary) — public scanner against all 10 OWASP ASI categories with Z3-verified safety contracts
- **Domain-Specific Fine-Tunes** — Qwen 2.5 7B base + chaos-remediation LoRA adapter trained on MI300X via PEFT/TRL on ROCm
- **x402 Challenge** — `POST /x402/scan/{tier}` returns the 402 challenge, settles via Coinbase facilitator on Base

Sponsor checkboxes hit:

- **AMD MI300X** — every Judge + Red call serves from MI300X. `rocm-smi` shows ~75 GB VRAM concurrent.
- **Hugging Face** — interactive Space (3 tabs: leaderboard, agent breakdown, judge verdict) + chaos LoRA model repo published.
- **Qwen** — Qwen 2.5 72B AWQ as Judge, Qwen 2.5 7B Instruct as Red + substitute target + LoRA fine-tune base.
- **MindsDB** — backs the digital-twin helpdesk data layer (`/twins/helpdesk/*`).
- **Akash Network** — `infra/akash-deploy.yaml` + Dockerfile + `infra/deploy.sh`.
- **x402 (Coinbase)** — `/x402/tiers` + `/x402/scan/{tier}`.

---

## Quick start (local)

### Prerequisites

- Python 3.11+ (3.12 / 3.13 also tested)
- Node 20+ and pnpm
- Docker + Docker Compose (optional — defaults to SQLite)
- For real verdicts: AMD MI300X via [AMD Developer Cloud](https://www.amd.com/en/developer.html). Otherwise run with `JUDGE_MODE=stub` for a deterministic offline heuristic.

### Setup

```bash
git clone https://github.com/vaatus/agentready.git
cd agentready
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]" && pip install aiosqlite greenlet
cp .env.example .env       # then fill HF_TOKEN, GITHUB_TOKEN
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

### Run a real scan against any GitHub repo

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
echo 'JUDGE_LLM_URL=http://your-mi300x-host:8003/v1' >> .env
echo 'JUDGE_LLM_MODEL=Qwen/Qwen2.5-72B-Instruct-AWQ' >> .env
echo 'RED_LLM_URL=http://your-mi300x-host:8001/v1' >> .env
echo 'RED_LLM_MODEL=Qwen/Qwen2.5-7B-Instruct' >> .env
```

---

## Production deploy on the same MI300X

`infra/docker-compose.deploy.yml` co-hosts the FastAPI backend and Next.js frontend on the MI300X instance that's already serving the two Qwen vLLM containers, on the host network. Rsync + compose:

```bash
rsync -az --exclude '.venv' --exclude 'node_modules' --exclude '.git' \
  ./ root@<MI300X-IP>:/root/agentready/

ssh root@<MI300X-IP> 'cd /root/agentready && \
  HF_TOKEN=hf_... PUBLIC_HOST=<MI300X-IP> \
  docker compose -f infra/docker-compose.deploy.yml up -d --build'
```

The vLLM Judge + Red containers need `VLLM_HOST_IP=127.0.0.1`, `GLOO_SOCKET_IFNAME=lo`, `NCCL_SOCKET_IFNAME=lo` to avoid binding their distributed-init socket to the public IP from inside `--network host`.

---

## User-submitted scans

Paste any GitHub URL on the scan page → live per-attack progress → redirect to the per-agent report.

![User scan progress](docs/screenshots/scan-progress.png)
![Scan history](docs/screenshots/scan-history.png)

History is stored in the browser's localStorage so a refresh doesn't lose the scan-in-progress. Once the GPU is offline, browsing the existing leaderboard still works through the static GitHub Pages mirror at [vaatus.github.io/agentready](https://vaatus.github.io/agentready/).

---

## Repository layout

| Path | What it does |
|---|---|
| `apps/api/` | FastAPI backend — routes, orchestrator, DB models, CLI |
| `apps/web/` | Next.js 14 frontend — leaderboard, per-agent reports, methodology, scan flow |
| `agents/` | LLM clients (Judge + Red), substitute target session, payload tailoring, remediation, GitHub PR opener |
| `owasp_asi/` | All 10 ASI attack modules (`asi01_goal_hijack.py` … `asi10_rogue_drift.py`) + ASI06 memory poisoning (two-session) + self-modifying memory novel attack |
| `chaos/` | Reliability surface + rate-limit fault injector |
| `verification/` | Z3 contract templates + NL→SMT auto-formalization + PDF certificate generator |
| `digital_twins/` | MindsDB-backed helpdesk twin |
| `leaderboard/` | Famous agents seed + batch runner |
| `infra/` | Dockerfiles + Akash SDL + production compose |
| `scripts/` | Hugging Face publish scripts (LoRA + multi-tab Space) + static GitHub Pages generator |
| `docs/` | Methodology markdown + static HTML mirror + screenshots |

---

## Key references

- [OWASP Top 10 for Agentic Applications 2026](https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/) — December 2025 standard, 10 risk categories ASI01–ASI10
- [ReliabilityBench (arXiv 2601.06112)](https://arxiv.org/abs/2601.06112) — Reliability Surface, chaos eval methodology
- [VERGE (arXiv 2601.20055)](https://arxiv.org/html/2601.20055v2) — Z3 SMT for verified LLM reasoning
- [Emergent Formal Verification / substrate-guard (arXiv 2603.21149)](https://arxiv.org/abs/2603.21149)
- [DeepTeam OWASP ASI framework](https://www.trydeepteam.com/docs/frameworks-owasp-top-10-for-agentic-applications)
- [Coinbase x402](https://docs.cdp.coinbase.com/x402/welcome)

---

## License

MIT — see [LICENSE](./LICENSE).
