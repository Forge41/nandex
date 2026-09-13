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

from apps.interview import coding_generation, sql_generation, task_bank
from apps.interview.config import settings
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts

logger = logging.getLogger(__name__)

# A generated test file either matches the canonical case list and is passable, or it is
# regenerated. Capped, because an uncapped retry is an unbounded wait in a timed round.
GENERATION_ATTEMPTS = 3

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
    brief = await sync_to_async(_brief_sync, thread_sensitive=True)(session.id, "sql")
    if brief is None:
        return None
    last: Exception | None = None
    for _ in range(GENERATION_ATTEMPTS):
        try:
            task = await sql_generation.generate(brief)
        except coding_generation.TaskUnusable as e:
            logger.warning("regenerating the SQL task: %s", e)
            last = e
            continue
        # Internals the generator needed and nothing else should keep.
        for key in [k for k in task if k.startswith("_")]:
            task.pop(key)
        task["index"], task["total"] = 1, 1
        return {"tasks": [task], "defaultLanguage": "sql"}
    raise coding_generation.TaskUnusable(str(last))


async def _generate_coding(session: InterviewSession) -> dict | None:
    """Two tasks, each with the evidenced language ready and the rest generated on demand.

    Only one language is prepared up front: four languages times two tasks is eight file
    generations for a round almost nobody answers in more than one language, and the other
    three are a request away when a candidate actually switches.
    """
    brief = await sync_to_async(_brief_sync, thread_sensitive=True)(session.id, "coding")
    if brief is None:
        return None

    wanted = evidenced_language(brief)

    # The bank first. Its tasks were proved runnable when they were imported, so setting
    # one costs nothing and cannot fail in the middle of an interview -- where generating
    # costs minutes and sometimes fails outright. Generation stays as the fallback for a
    # bank that has nothing, which is the only case worth paying for it.
    banked = task_bank.pick(CODING_TASKS, seed=session.id, language=wanted)
    if len(banked) == CODING_TASKS:
        return _from_bank(banked, wanted)

    tasks = []
    for index in range(CODING_TASKS):
        task = await coding_generation.generate_task({**brief, "taskNumber": index + 1})
        task["index"] = index + 1
        task["total"] = CODING_TASKS
        task["languages"] = {}
        # Each task records the language it was actually produced in, because a fallback
        # applies to one task and not to the round: a round-level default would point the
        # second task at a language nobody generated for it, and opening it would start a
        # model call in the middle of a timed interview.
        task["defaultLanguage"] = await attach_first_workable(task, wanted)
        # The next task prefers whatever the last one settled on, so a round stays in one
        # language unless a task genuinely could not be written in it.
        wanted = task["defaultLanguage"]
        tasks.append(task)
    return {"tasks": tasks, "defaultLanguage": tasks[0]["defaultLanguage"]}


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


async def attach_first_workable(task: dict, wanted: str) -> str:
    """The evidenced language if it can be produced, otherwise the next one that can.

    A task is only accepted once its own reference solution passes its own tests, and
    some languages fail that more often than others -- C++ under sanitizers most of all.
    Failing the round over it would be the wrong trade: the candidate loses the round
    entirely rather than sitting it in a language they also know, and the switcher will
    offer the others anyway.
    """
    order = [wanted, *(lang for lang in coding_generation.LANGUAGE_IDS if lang != wanted)]
    last: Exception | None = None
    for language in order:
        try:
            await attach_language(task, language)
        except coding_generation.TaskUnusable as e:
            logger.warning("could not produce %s for %s: %s", language, task.get("title"), e)
            last = e
            continue
        if language != wanted:
            logger.info("fell back to %s for %s", language, task.get("title"))
        return language
    raise coding_generation.TaskUnusable(str(last))


async def attach_language(task: dict, language: str) -> dict:
    """Generates one language's files for a task and proves they can be passed.

    Regenerates on a verification failure rather than shipping the task: a test file no
    correct solution satisfies produces real failures and a false verdict.
    """
    last: Exception | None = None
    for _ in range(GENERATION_ATTEMPTS):
        try:
            written = await coding_generation.generate_files(task, language)
            await coding_generation.verify(task, language, written)
        except coding_generation.TaskUnusable as e:
            logger.warning("regenerating %s for %s: %s", language, task.get("title"), e)
            last = e
            continue
        task.setdefault("languages", {})[language] = {"files": written["files"]}
        return task
    raise coding_generation.TaskUnusable(str(last))


# Evidence, not preference: a resume full of Java gets Java, and the interviewer can say
# why. A candidate whose language is not one of the four gets Python and is told so
# rather than silently handed a language they do not work in.
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
    # Only when it points at a citation the resume really produced.
    citation = written.get("citation")
    if isinstance(citation, int) and citation in {c["id"] for c in brief["citations"]}:
        content["citation"] = citation
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
        "citations": [c for c in facts.citations if isinstance(c.get("id"), int)],
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
