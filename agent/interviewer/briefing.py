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
    prompt = f"{load_prompt('interviewer_plan_stage.md')}\n\n{describe(brief)}"
    context = coding_context(brief)
    return f"{prompt}\n\n## The round they are in now\n\n{context}" if context else prompt


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


def coding_context(brief: Brief) -> str:
    """What the interviewer knows while the candidate writes code.

    Counts and failing case names, never the source. Everything here is phrased as
    something the candidate can already see on their own screen, because that is exactly
    what it is -- the interviewer is looking at the same panel, not over their shoulder.
    """
    coding = brief.coding
    if not coding:
        return ""

    lines = [
        f"The candidate is on task {coding.get('taskNumber')} of {coding.get('taskTotal')}: "
        f"{coding.get('title')}.",
    ]
    for paragraph in coding.get("brief") or []:
        lines.append(f"  {paragraph}")
    if coding.get("language"):
        lines.append(f"They are writing it in {coding['language']}.")

    if not coding.get("hasRun"):
        lines.append(
            "They have not run their tests yet. Do not ask about results they have not got."
        )
        return "\n".join(lines)

    phase = coding.get("phase")
    if phase == "compile_failed":
        lines.append(
            "Their last run did not compile, so no tests ran and no attempt was used. "
            "You may not know what the error was; ask rather than guess."
        )
    elif phase in ("crashed", "timeout"):
        lines.append(
            f"Their last run ended early ({phase}), so some cases never ran. "
            "Cases with no result are unknown, not failures."
        )
    else:
        passed, total = coding.get("passed", 0), coding.get("total", 0)
        lines.append(f"Their last run passed {passed} of {total} visible tests.")
        failing = coding.get("failing") or []
        if failing:
            lines.append(f"Failing: {', '.join(failing)}.")

    lines.append(
        f"They have used {coding.get('attemptsUsed')} of {coding.get('attemptsAllowed')} attempts."
    )
    lines.append(
        "You cannot see their code. Ask about approach and about the failing cases by "
        "name; do not offer the fix."
    )
    return "\n".join(lines)
