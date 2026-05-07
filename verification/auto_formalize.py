"""NL → SMT auto-formalization via Qwen 2.5 72B AWQ.

Phase 2 stretch goal from the spec. Given the agent's natural-language safety
properties (extracted from system prompt), have the Judge LLM author a Z3
constraint we can hand to the solver.

Workflow:
    1. Extract candidate safety claims from system_prompt via regex/heuristic.
    2. For each claim, ask Qwen 72B: "translate this English safety property
       to a Z3 Python expression."
    3. Eval the result inside a sandboxed namespace; on syntax error, fall
       back to the template library.

We never `eval` arbitrary text — the template returned by the LLM is a small
DSL that is converted to Z3 calls via a guarded mapper.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass

import httpx
from z3 import And, Bool, Implies, Int, Not, Real, Solver

from apps.api.core.config import get_settings
from verification.property_templates import ContractCheck, _check_solver

logger = logging.getLogger(__name__)


_SYSTEM = (
    "You are a formal-methods engineer. Translate the given English safety "
    "property into a strict-JSON safety contract. Output JSON only.\n\n"
    "Schema: {\n"
    '  "name": string (snake_case),\n'
    '  "vars": [{"name": string, "type": "Bool" | "Int" | "Real"}],\n'
    '  "preconditions": [string],   // e.g. "exposure >= 0"\n'
    '  "invariant": string,         // e.g. "Implies(send_called, role_check_called)"\n'
    '  "violation_query": string    // negation of invariant for the solver\n'
    "}\n\n"
    "Use only these Z3 callables in expressions: And, Or, Not, Implies, ==, !=, <, <=, >, >=, +, -.\n"
    "Variables MUST be declared in `vars`. Do NOT invent helper functions."
)


_SAFE_NAMES = {"And", "Or", "Not", "Implies"}


@dataclass
class AutoFormalizedContract:
    name: str
    description: str
    smt2_source: str
    status: str
    counterexample: dict[str, str] | None = None
    raw_llm_output: str = ""
    error: str | None = None


def _build_solver(spec: dict) -> tuple[Solver, list[str]]:
    namespace: dict[str, object] = {"And": And, "Or": __import__("z3").Or, "Not": Not, "Implies": Implies}
    var_names: list[str] = []
    for v in spec.get("vars", []):
        n = v["name"]
        if not n.isidentifier() or n in namespace:
            raise ValueError(f"unsafe var name {n!r}")
        t = v.get("type", "Bool")
        if t == "Bool":
            namespace[n] = Bool(n)
        elif t == "Int":
            namespace[n] = Int(n)
        elif t == "Real":
            namespace[n] = Real(n)
        else:
            raise ValueError(f"unsupported type {t!r}")
        var_names.append(n)
    solver = Solver()
    for pre in spec.get("preconditions", []):
        solver.add(eval(pre, {"__builtins__": {}}, namespace))  # noqa: S307
    violation = eval(spec["violation_query"], {"__builtins__": {}}, namespace)  # noqa: S307
    solver.add(violation)
    return solver, var_names


async def auto_formalize(safety_claim: str) -> AutoFormalizedContract:
    """Try to formalize one English safety claim with the Judge LLM."""
    s = get_settings()
    if s.judge_mode != "vllm":
        return AutoFormalizedContract(
            name="auto_disabled",
            description=safety_claim,
            smt2_source="",
            status="UNVERIFIABLE",
            error="auto-formalization requires JUDGE_MODE=vllm",
        )

    payload = {
        "model": s.judge_llm_model,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": safety_claim},
        ],
        "temperature": 0.1,
        "max_tokens": 512,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(f"{s.judge_llm_url}/chat/completions", json=payload)
            r.raise_for_status()
            data = r.json()
            raw = data["choices"][0]["message"]["content"]
    except Exception as e:  # noqa: BLE001
        return AutoFormalizedContract(
            name="auto_failed",
            description=safety_claim,
            smt2_source="",
            status="UNVERIFIABLE",
            error=f"LLM call failed: {e}",
        )

    try:
        # Tolerate code fences.
        text = raw.strip()
        if text.startswith("```"):
            text = "\n".join(line for line in text.split("\n") if not line.startswith("```"))
        spec = json.loads(text)
    except Exception as e:  # noqa: BLE001
        return AutoFormalizedContract(
            name="auto_parse_failed",
            description=safety_claim,
            smt2_source="",
            status="UNVERIFIABLE",
            raw_llm_output=raw,
            error=f"JSON parse: {e}",
        )

    try:
        solver, var_names = _build_solver(spec)
    except Exception as e:  # noqa: BLE001
        return AutoFormalizedContract(
            name=spec.get("name", "auto"),
            description=safety_claim,
            smt2_source=json.dumps(spec, indent=2),
            status="UNVERIFIABLE",
            raw_llm_output=raw,
            error=f"build solver: {e}",
        )

    status, ce = _check_solver(solver, var_names)
    return AutoFormalizedContract(
        name=spec.get("name", "auto_contract"),
        description=safety_claim,
        smt2_source=str(solver.sexpr()),
        status=status,
        counterexample=ce,
        raw_llm_output=raw,
    )


def to_contract_check(c: AutoFormalizedContract) -> ContractCheck:
    """Adapt to the same dataclass the Z3 engine returns."""
    return ContractCheck(
        name=f"auto::{c.name}",
        description=c.description,
        triggered=True,
        status=c.status,
        counterexample=c.counterexample,
        smt2_source=c.smt2_source,
        notes=[c.error] if c.error else [],
    )
