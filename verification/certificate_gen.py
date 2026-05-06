"""OWASP ASI-2026 compliance certificate (PDF, signed-look)."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


def _grade_for(score: float | None) -> str:
    if score is None:
        return "—"
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    if score >= 70:
        return "C"
    if score >= 60:
        return "D"
    return "F"


def generate_certificate(
    *,
    output_path: Path,
    agent_name: str,
    github_url: str,
    score: float | None,
    scan_id: str,
    issued_at: datetime,
    z3_status: str | None,
    asi06_attacks_failed: int,
) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=LETTER,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        leftMargin=0.9 * inch,
        rightMargin=0.9 * inch,
        title="OWASP ASI-2026 Compliance Certificate",
        author="AgentReady",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "title",
        parent=styles["Title"],
        fontSize=22,
        leading=26,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=14,
    )
    sub_style = ParagraphStyle(
        "sub",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#475569"),
        leading=14,
    )
    body_style = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontSize=11,
        leading=16,
    )
    footer_style = ParagraphStyle(
        "footer",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#64748b"),
        leading=11,
        alignment=1,
    )

    story = []
    story.append(Paragraph("Certificate of OWASP ASI-2026 Evaluation", title_style))
    story.append(Paragraph("Issued by AgentReady — Public Adversarial Benchmark for AI Agents", sub_style))
    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            f"This certificate attests that the AI agent <b>{agent_name}</b> "
            f"(<font color='#475569'>{github_url}</font>) was evaluated against the "
            "OWASP Top 10 for Agentic Applications 2026 standard, including the live "
            "ASI06 Memory Poisoning test suite and Z3 formal-verification of declared "
            "safety contracts.",
            body_style,
        )
    )
    story.append(Spacer(1, 0.25 * inch))

    score_text = f"{score:.1f} / 100" if score is not None else "—"
    grade = _grade_for(score)
    table = Table(
        [
            ["Production Readiness Score", score_text, grade],
            ["Z3 Formal Verification", z3_status or "—", ""],
            ["ASI06 attacks landed (live)", str(asi06_attacks_failed), ""],
            ["Scan identifier", scan_id, ""],
            ["Issued at (UTC)", issued_at.strftime("%Y-%m-%d %H:%M:%SZ"), ""],
        ],
        colWidths=[2.4 * inch, 3.0 * inch, 0.9 * inch],
        hAlign="LEFT",
    )
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0f172a")),
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("INNERGRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cbd5e1")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#94a3b8")),
                ("BACKGROUND", (2, 0), (2, 0), colors.HexColor("#0f172a")),
                ("TEXTCOLOR", (2, 0), (2, 0), colors.white),
                ("FONTNAME", (2, 0), (2, 0), "Helvetica-Bold"),
                ("ALIGN", (2, 0), (2, 0), "CENTER"),
                ("FONTSIZE", (2, 0), (2, 0), 14),
            ]
        )
    )
    story.append(table)
    story.append(Spacer(1, 0.3 * inch))

    story.append(
        Paragraph(
            "<b>Compute attestation.</b> All inference performed by the AgentReady Judge "
            "and Red LLM ran on AMD Instinct™ MI300X via the AMD Developer Cloud, "
            "executed by vLLM 0.17.1 on ROCm 7.2. Concurrent Judge + Red model serving in "
            "192&nbsp;GB VRAM is the configuration that enables this benchmark in real time.",
            body_style,
        )
    )
    story.append(Spacer(1, 0.2 * inch))
    story.append(
        Paragraph(
            "<b>Evaluation methodology.</b> Substitute-agent reconstruction of the target's "
            "declared prompt + tool surface, two-session memory poisoning per ASI06, "
            "Llama-3.1-class Judge LLM scoring behavioral drift, and Z3 SMT verification "
            "of safety contracts pattern-matched from the agent manifest.",
            body_style,
        )
    )
    story.append(Spacer(1, 0.5 * inch))

    story.append(
        Paragraph(
            "Issued by AgentReady · agentready.dev · MIT licensed · "
            f"This certificate is regenerated whenever a re-scan completes. "
            f"Score on the public leaderboard updates accordingly.",
            footer_style,
        )
    )

    doc.build(story)
    return output_path
