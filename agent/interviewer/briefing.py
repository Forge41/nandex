"""Turns a session brief into the instructions the interviewer speaks from.

Pure, so what the agent is told can be read in a test rather than inferred from a
recording of it talking.
"""

from pathlib import Path

from interviewer.core_client import Brief

PROMPTS = Path(__file__).parent / "prompts"

# Rounds short enough that naming each one aloud costs more than it tells the candidate.
# Matches the frontend's FEATURED_MIN_DURATION, which decides the same thing visually.
FEATURED_MIN_DURATION = 10


def load_prompt(name: str) -> str:
    return (PROMPTS / name).read_text(encoding="utf-8")


def instructions_for(brief: Brief) -> str:
    """The system prompt plus this candidate's own plan, as prose.

    Prose rather than JSON: the model is about to speak these sentences, and a schema
    invites it to read the schema aloud.
    """
    return f"{load_prompt('interviewer_plan_stage.md')}\n\n{describe(brief)}"


def describe(brief: Brief) -> str:
    lines = ["## This candidate", ""]
    lines.append(f"Name: {brief.candidate_name or 'not given -- do not guess, just say hello'}")
    if brief.candidate_title:
        lines.append(f"Their resume describes them as: {brief.candidate_title}")
    lines.append(f"Interviewing for: {brief.role_title}")
    lines.append(f"The whole interview runs about {brief.total_duration_min} minutes.")

    featured = [r for r in brief.rounds if (r.get("durationMin") or 0) >= FEATURED_MIN_DURATION]
    shorter = [r for r in brief.rounds if (r.get("durationMin") or 0) < FEATURED_MIN_DURATION]

    lines += ["", "## The rounds you planned, and what each came from", ""]
    for round_ in featured:
        lines.append(_round_line(brief, round_))
    if shorter:
        names = ", ".join(str(r.get("label") or r.get("id")) for r in shorter)
        total = sum(r.get("durationMin") or 0 for r in shorter)
        lines.append(
            f"- Then {len(shorter)} shorter rounds, about {total} minutes together: {names}. "
            "Summarise these; do not read them out one by one."
        )

    if brief.probes:
        lines += ["", "## What you intend to probe, if they ask", ""]
        for probe in brief.probes:
            quote = brief.quote_for(probe.get("citation"))
            source = f' — from their line "{quote}"' if quote else ""
            lines.append(f"- {probe.get('title')}: {probe.get('note')}{source}")

    return "\n".join(lines)


def _round_line(brief: Brief, round_: dict) -> str:
    quote = brief.quote_for(round_.get("citation"))
    label = round_.get("label") or round_.get("id")
    minutes = round_.get("durationMin") or 0
    summary = (round_.get("summary") or "").strip()

    line = f"- {label} ({minutes} min)"
    if summary:
        # The plan's summaries are written as fragments, so a full stop is added here
        # rather than expected of them -- two sentences running together read as one.
        line += f": {summary.rstrip('.')}."
    if quote:
        # The verbatim line, so the interviewer can quote it rather than paraphrase.
        line += f' Chosen because they wrote "{quote}".'
    return line


def greeting_instruction(brief: Brief) -> str:
    """What to say first, without scripting the words.

    An instruction rather than a fixed line: a hardcoded greeting is the same sentence for
    every candidate, which is exactly what this plan is not.
    """
    who = brief.candidate_name or "the candidate"
    return (
        f"Greet {who} by name, say you have read their resume, and walk them through the "
        "plan and why each round is there. Finish by inviting questions and telling them "
        "nothing is being assessed until they press Start interview."
    )
