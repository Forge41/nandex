"""Generates the task inside one round, from the plan the resume produced.

One generator per stage rather than one prompt for all of them: a behavioral question, a
coding task with starter files and a SQL schema share no output shape, and a single
prompt asked for all three returns a worse version of each.

Stages absent from GENERATABLE_STAGE_IDS have no generator yet. They keep an empty
payload and the UI renders its missing-content state, which is honest where inventing a
task would not be.
"""

import json
import logging

from ai.client import complete
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.interview import sql_bank, task_bank
from apps.interview.config import settings
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts

logger = logging.getLogger(__name__)

# A generated test file either matches the canonical case list and is passable, or it is

GENERATABLE_STAGE_IDS = frozenset({"behavioral", "coding", "sql"})

# How many tasks one coding round holds. Fixed here rather than left to whatever the model
# emits, so two candidates sitting the same round get the same shape of interview.
CODING_TASKS = 2


class RoundContentUnusable(Exception):
    """The model's answer for a round could not be understood."""


async def generate(session: InterviewSession, stage_id: str) -> dict | None:
    if stage_id not in GENERATABLE_STAGE_IDS:
        return None
    if stage_id == "coding":
        return await _generate_coding(session)
    if stage_id == "sql":
        return await _generate_sql(session)
    return await _generate_behavioral(session)


async def _generate_sql(session: InterviewSession) -> dict | None:
    """One task from the bank.

    Not generated: a SQL task is only usable once its reference query has been run
    against its own schema, and doing that inside an interview costs ten seconds and can
    fail outright. The bank's tasks were run when they were built, so setting one is a
    dictionary lookup.
    """
    task = await sync_to_async(sql_bank.pick, thread_sensitive=True)(seed=session.id)
    if task is None:
        return None
    return {"tasks": [{**task, "index": 1, "total": 1}], "defaultLanguage": "sql"}


async def _generate_coding(session: InterviewSession) -> dict | None:
    """Two tasks from the bank, in the language the resume evidences where it has one."""
    brief = await sync_to_async(_brief_sync, thread_sensitive=True)(session.id, "coding")
    if brief is None:
        return None

    wanted = evidenced_language(brief)

    # The bank, and only the bank. Its tasks were proved runnable when they were
    # imported; a generated one costs minutes of an interview, can fail in the middle of
    # one, and is no better a question than an exercise somebody already wrote.
    banked = task_bank.pick(CODING_TASKS, seed=session.id, language=wanted)
    if not banked:
        return None
    return _from_bank(banked, wanted)


def _from_bank(banked: list[dict], wanted: str) -> dict:
    tasks = []
    for index, task in enumerate(banked):
        available = list(task.get("languages") or {})
        tasks.append(
            {
                **task,
                "index": index + 1,
                "total": len(banked),
                # The evidenced language when this task has it, and what it does have
                # otherwise. A track is not available for every exercise, and pointing the
                # editor at one nobody imported would show an empty round.
                "defaultLanguage": wanted if wanted in available else available[0],
            }
        )
    return {"tasks": tasks, "defaultLanguage": tasks[0]["defaultLanguage"]}


# Which language a resume gives us reason to set. Markers rather than a model call: the
# question is only "which of four", and the evidence is the words the candidate used.
LANGUAGE_EVIDENCE = {
    "cpp": ("c++", "cpp"),
    "java": ("java", "kotlin", "spring", "jvm"),
    "c": ("embedded", " c ", "kernel", "firmware"),
    "python": ("python", "django", "flask", "pandas"),
}


def evidenced_language(brief: dict) -> str:
    haystack = json.dumps(brief).lower()
    best, best_count = "python", 0
    for language, markers in LANGUAGE_EVIDENCE.items():
        count = sum(haystack.count(marker) for marker in markers)
        if count > best_count:
            best, best_count = language, count
    return best


async def _generate_behavioral(session: InterviewSession) -> dict | None:
    brief = await sync_to_async(_brief_sync, thread_sensitive=True)(session.id, "behavioral")
    if brief is None:
        return None

    raw = await complete(
        system_prompt=load_prompt("interview_round_behavioral_system.md"),
        messages=[{"role": "user", "content": json.dumps(brief)}],
        model=settings.plan_model,
        fast=True,
    )
    written = _decode(raw)

    question = str(written.get("question") or "").strip()
    if not question:
        raise RoundContentUnusable("The round question was empty")

    derived = [
        str(label).strip() for label in written.get("derivedFrom") or [] if str(label).strip()
    ][:3]

    content = {
        "questionNumber": 1,
        "question": question,
        # Never empty: the stage renders these as the question's provenance, and a
        # question with no stated source is the thing this whole plan exists to avoid.
        "derivedFrom": derived or ["your resume"],
    }
    return content


def _brief_sync(session_id: str, stage_id: str) -> dict | None:
    """What the model is told: this round, and the probes already tied to it.

    None when no plan exists yet -- generating a question from nothing would produce a
    generic interview, which is the opposite of the point.
    """
    facts = ResumeFacts.objects.filter(session_id=session_id).first()
    round_ = InterviewRound.objects.filter(session_id=session_id, stage_id=stage_id).first()
    if facts is None or round_ is None:
        return None

    return {
        "role": round_.session.role_title,
        "round": {"id": stage_id, "label": round_.label, "summary": round_.summary},
        "probes": [p for p in facts.probes if p.get("round") == stage_id],
    }


def _decode(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1].removeprefix("json").strip()
    try:
        written = json.loads(text)
    except json.JSONDecodeError as e:
        raise RoundContentUnusable("The round content was not valid JSON") from e
    if not isinstance(written, dict):
        raise RoundContentUnusable("The round content was not an object")
    return written
