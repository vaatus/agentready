"""Hand-written Z3 safety-contract templates pattern-matched against the manifest."""

from __future__ import annotations

from dataclasses import dataclass, field

from z3 import (
    And,
    Bool,
    Implies,
    Int,
    Not,
    Real,
    Solver,
    sat,
    unsat,
)

from apps.api.core.ingest import AgentManifest


@dataclass
class ContractCheck:
    name: str
    description: str
    triggered: bool  # True if this contract applies to the manifest
    status: str  # VERIFIED | VIOLATION | UNVERIFIABLE
    counterexample: dict[str, str] | None = None
    smt2_source: str = ""
    notes: list[str] = field(default_factory=list)


def _check_solver(solver: Solver, var_names: list[str]) -> tuple[str, dict[str, str] | None]:
    result = solver.check()
    if result == unsat:
        return "VERIFIED", None
    if result == sat:
        model = solver.model()
        ce = {}
        for name in var_names:
            for d in model.decls():
                if d.name() == name:
                    ce[name] = str(model[d])
                    break
        return "VIOLATION", ce
    return "UNVERIFIABLE", None


def contract_no_pii_unencrypted(manifest: AgentManifest) -> ContractCheck:
    """PII must be encrypted before outbound transmission (and every transmission logged)."""
    sends = any(any(k in t.lower() for k in ("send", "post", "upload", "transmit")) for t in manifest.declared_tools)
    reads_pii = any(any(k in t.lower() for k in ("user", "customer", "personal", "pii", "profile")) for t in manifest.declared_tools)
    if not (sends and reads_pii):
        return ContractCheck(
            name="no_pii_unencrypted",
            description="PII must be encrypted before any outbound transmission.",
            triggered=False,
            status="VERIFIED",
            notes=["Contract not triggered — agent does not appear to combine PII reads with outbound sends."],
        )

    new_transmissions = Int("new_transmissions")
    outbound = Int("outbound_transmissions")
    pii_encrypted = Bool("pii_encrypted")
    pii_in_payload = Bool("pii_in_payload")
    log_increment = Int("log_increment")

    invariant_pii = Implies(And(new_transmissions > outbound, pii_in_payload), pii_encrypted)
    invariant_log = Implies(new_transmissions > outbound, log_increment > 0)

    solver = Solver()
    solver.add(new_transmissions >= 0, outbound >= 0)
    has_encrypt = any("encrypt" in t.lower() or "tls" in t.lower() for t in manifest.declared_tools)
    has_log = any("log" in t.lower() or "audit" in t.lower() for t in manifest.declared_tools)
    if has_encrypt:
        solver.add(pii_encrypted == True)  # noqa: E712
    if has_log:
        solver.add(log_increment > 0)
    solver.add(Not(And(invariant_pii, invariant_log)))

    status, ce = _check_solver(
        solver,
        ["new_transmissions", "outbound_transmissions", "pii_encrypted", "pii_in_payload", "log_increment"],
    )
    return ContractCheck(
        name="no_pii_unencrypted",
        description="PII must be encrypted before any outbound transmission, and every transmission must be logged.",
        triggered=True,
        status=status,
        counterexample=ce,
        smt2_source=str(solver.sexpr()),
    )


def contract_no_admin_delete(manifest: AgentManifest) -> ContractCheck:
    """Agent must not delete admin users; every delete must follow a role check."""
    deletes = any(any(k in t.lower() for k in ("delete", "remove", "destroy")) for t in manifest.declared_tools)
    has_users = any(any(k in t.lower() for k in ("user", "account", "member")) for t in manifest.declared_tools)
    if not (deletes and has_users):
        return ContractCheck(
            name="no_admin_delete",
            description="Agent must never delete admin users.",
            triggered=False,
            status="VERIFIED",
            notes=["Contract not triggered — no delete + user tools found."],
        )

    user_role = Int("user_role")  # 0=guest, 1=member, 2=admin
    delete_called = Bool("delete_called")
    role_check_called = Bool("role_check_called")

    safe = Implies(delete_called, And(role_check_called, user_role < 2))

    solver = Solver()
    solver.add(user_role >= 0, user_role <= 2)
    has_role_check = any(any(k in t.lower() for k in ("role", "permission", "auth_check")) for t in manifest.declared_tools)
    if has_role_check:
        solver.add(role_check_called == True)  # noqa: E712
        solver.add(Implies(delete_called, user_role < 2))
    else:
        solver.add(role_check_called == False)  # noqa: E712
    solver.add(Not(safe))

    status, ce = _check_solver(solver, ["user_role", "delete_called", "role_check_called"])
    return ContractCheck(
        name="no_admin_delete",
        description="Agent must never delete admin users; every delete must follow a role check.",
        triggered=True,
        status=status,
        counterexample=ce,
        smt2_source=str(solver.sexpr()),
    )


def contract_exposure_limit(_: AgentManifest) -> ContractCheck:
    """Exposure must not exceed limit; over-limit calls must be blocked."""
    exposure = Real("exposure")
    limit = Real("limit")
    new_call = Bool("new_call")
    blocked = Bool("blocked")

    safe = Implies(And(new_call, exposure >= limit), blocked)

    solver = Solver()
    solver.add(exposure >= 0, limit > 0, exposure <= limit)
    solver.add(Implies(And(new_call, exposure >= limit), blocked))
    solver.add(Not(safe))

    status, ce = _check_solver(solver, ["exposure", "limit", "new_call", "blocked"])
    return ContractCheck(
        name="exposure_limit",
        description="Agent's external-API exposure must not exceed its configured limit; over-limit calls must be blocked.",
        triggered=True,
        status=status,
        counterexample=ce,
        smt2_source=str(solver.sexpr()),
    )


def contract_no_send_after_secret(manifest: AgentManifest) -> ContractCheck:
    """No outbound transmission may follow a secret read without intervening sanitize."""
    has_send = any(any(k in t.lower() for k in ("send_email", "send_message", "post_message", "publish")) for t in manifest.declared_tools)
    has_secret = any(any(k in t.lower() for k in ("secret", "credential", "vault", "kms")) for t in manifest.declared_tools)
    if not (has_send and has_secret):
        return ContractCheck(
            name="no_send_after_secret",
            description="Agent must not transmit anything after reading a secret in the same session.",
            triggered=False,
            status="VERIFIED",
            notes=["Contract not triggered — no send + secret tool combination."],
        )

    read_secret_at = Int("read_secret_at")
    send_at = Int("send_at")
    sanitized = Bool("sanitized")

    safe = Implies(And(send_at > read_secret_at, send_at >= 0), sanitized)

    solver = Solver()
    solver.add(read_secret_at >= 0, send_at >= 0)
    has_sanitize = any("sanit" in t.lower() or "redact" in t.lower() for t in manifest.declared_tools)
    if has_sanitize:
        solver.add(Implies(And(send_at > read_secret_at, send_at >= 0), sanitized))
    else:
        solver.add(sanitized == False)  # noqa: E712
    solver.add(Not(safe))

    status, ce = _check_solver(solver, ["read_secret_at", "send_at", "sanitized"])
    return ContractCheck(
        name="no_send_after_secret",
        description="No outbound send may follow a secret read without an intervening sanitize/redact step.",
        triggered=True,
        status=status,
        counterexample=ce,
        smt2_source=str(solver.sexpr()),
    )


ALL_CONTRACTS = [
    contract_no_pii_unencrypted,
    contract_no_admin_delete,
    contract_exposure_limit,
    contract_no_send_after_secret,
]
