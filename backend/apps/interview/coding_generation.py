"""Generating the coding round: one task spec, then files per language.

Split in two because the same task is answered in four languages and the cases must be the
same cases. Generating each language independently would let the Java task drift from the
Python one, and the panel beside the editor would be grading something different depending
on which chip is selected.

So the spec -- including the canonical test-case list -- is written once, language-
independent, and each language's files are written against it and then **verified by
running them**: the generated reference solution must pass every canonical case in the
real sandbox. Matching names proves the cases exist. Only a run proves the task can be
solved at all, and a candidate graded against an unsolvable test file gets real failures
and a false verdict -- the same harm as a fabricated result, arriving by a different door.
"""

from __future__ import annotations

import json
import logging

from ai.client import complete
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.core.clients import runner_client
from apps.interview.config import settings

logger = logging.getLogger(__name__)

TASK_PROMPT = "interview_round_coding_task_system.md"
FILES_PROMPT = "interview_round_coding_files_system.md"

LANGUAGE_IDS = ("python", "java", "c", "cpp")

SOLUTION_NAMES = {
    "python": "solution.py",
    "java": "Solution.java",
    "c": "solution.c",
    "cpp": "solution.cpp",
}
TEST_NAMES = {
    "python": "test_solution.py",
    "java": "SolutionTest.java",
    "c": "test_solution.cpp",
    "cpp": "test_solution.cpp",
}

# Fields a model may not write, because only a run produces them. Stripped rather than
# rejected: the rest of the task is still usable, and a silently-kept `outcome` would be a
# test result for code nobody executed.
FORBIDDEN = (
    "outcome",
    "durationMs",
    "terminal",
    "exitCode",
    "attemptsUsed",
    "attemptOutcomes",
    "lastRunSummary",
)

DIFFICULTIES = {"jade", "gold", "danger"}


class TaskUnusable(Exception):
    """The model's answer could not be turned into a task anyone could sit."""


async def generate_task(brief: dict) -> dict:
    """The language-independent spec, including the canonical test list."""
    raw = await complete(
        system_prompt=load_prompt(TASK_PROMPT),
        messages=[{"role": "user", "content": json.dumps(brief)}],
        model=settings.plan_model,
    )
    return _sanitize_task(_decode(raw))


async def generate_files(task: dict, language: str) -> dict:
    """One language's starter and test files, verified against the canonical list.

    Returns `{"files": [...], "reference": "..."}`; the reference is never stored on the
    task and never reaches the candidate.
    """
    if language not in LANGUAGE_IDS:
        raise TaskUnusable(f"unsupported language {language}")

    asked = {
        "language": language,
        "title": task["title"],
        "brief": task["brief"],
        "example": task["example"],
        "constraints": task["constraints"],
        "tests": task["tests"],
        "solutionFile": SOLUTION_NAMES[language],
        "testFile": TEST_NAMES[language],
    }
    raw = await complete(
        system_prompt=load_prompt(FILES_PROMPT),
        messages=[{"role": "user", "content": json.dumps(asked)}],
        model=settings.plan_model,
    )
    written = _decode(raw)

    files = _sanitize_files(written.get("files"), language)
    reference = str(written.get("reference") or "").strip()
    if not reference:
        raise TaskUnusable("no reference solution was written")
    return {"files": files, "reference": reference}


async def verify(task: dict, language: str, generated: dict) -> None:
    """Runs the reference solution against the generated tests, in the real sandbox.

    Raises when the task is not solvable as written, or when the cases that ran are not
    the cases the panel will claim ran.
    """
    files = {f["name"]: f["content"] for f in generated["files"]}
    files[SOLUTION_NAMES[language]] = generated["reference"]

    done = None
    for event in await sync_to_async(_run_sync, thread_sensitive=False)(language, files):
        if event["event"] == "done":
            done = event["data"]

    if done is None or done.get("phase") != "ran":
        raise TaskUnusable(
            f"the reference solution did not run ({(done or {}).get('phase', 'no result')})"
        )

    reported = {t["name"] for t in done.get("tests", []) if t.get("name")}
    expected = {t["name"] for t in task["tests"]}
    if reported != expected:
        raise TaskUnusable(f"tests ran {sorted(reported)}, task promises {sorted(expected)}")

    failed = [t["name"] for t in done["tests"] if t.get("outcome") == "fail"]
    if failed:
        raise TaskUnusable(f"the reference solution fails its own tests: {failed}")


def _run_sync(language: str, files: dict[str, str]) -> list[dict]:
    return list(runner_client.run(language=language, files=files))


def _sanitize_task(written: dict) -> dict:
    title = str(written.get("title") or "").strip()
    if not title:
        raise TaskUnusable("the task had no title")

    tests = _sanitize_tests(written.get("tests"))
    difficulty = str(written.get("difficulty") or "gold")
    task = {
        "title": title,
        "difficulty": difficulty if difficulty in DIFFICULTIES else "gold",
        "difficultyLabel": str(written.get("difficultyLabel") or "Medium").strip(),
        "brief": [str(p).strip() for p in written.get("brief") or [] if str(p).strip()][:4],
        "example": str(written.get("example") or "").strip(),
        "constraints": [str(c).strip() for c in written.get("constraints") or [] if str(c).strip()][
            :6
        ],
        "complexity": _sanitize_complexity(written.get("complexity")),
        "attemptsAllowed": _attempts(written.get("attemptsAllowed")),
        "tests": tests,
    }
    note = str(written.get("complexityNote") or "").strip()
    if note:
        task["complexityNote"] = note
    citation = written.get("citation")
    if isinstance(citation, int):
        task["citation"] = citation
    if not task["brief"]:
        raise TaskUnusable("the task had no brief")
    return task


def _sanitize_tests(written) -> list[dict]:
    if not isinstance(written, list):
        raise TaskUnusable("the task listed no tests")
    seen, tests = set(), []
    for entry in written:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip()
        if not name or name in seen:
            continue
        seen.add(name)
        # `hidden` is a property of the case. Any outcome the model offered is dropped
        # here: it is a claim about a run that has not happened.
        tests.append({"name": name, "hidden": bool(entry.get("hidden"))})
    if len(tests) < 2:
        raise TaskUnusable("the task needs at least two test cases")
    return tests[:10]


def _sanitize_complexity(written) -> list[dict]:
    rows = []
    for entry in written or []:
        if not isinstance(entry, dict):
            continue
        label = str(entry.get("label") or "").strip()
        value = str(entry.get("value") or "").strip()
        if not label or not value:
            continue
        row = {"label": label, "value": value}
        if entry.get("tone") in ("warning", "danger", "success"):
            row["tone"] = entry["tone"]
        rows.append(row)
    return rows[:4]


def _sanitize_files(written, language: str) -> list[dict]:
    if not isinstance(written, list):
        raise TaskUnusable("no files were written")

    solution, tests = SOLUTION_NAMES[language], TEST_NAMES[language]
    allowed = {solution, tests, "solution.h"}
    files, names = [], set()
    for entry in written:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("name") or "").strip()
        if name not in allowed or name in names:
            continue
        names.add(name)
        files.append(
            {
                "name": name,
                "language": language,
                "content": str(entry.get("content") or ""),
                # The test file is never the candidate's to edit, whatever the model
                # said about it. Core enforces this again when a draft is saved.
                "readOnly": name == tests,
            }
        )
    if solution not in names or tests not in names:
        raise TaskUnusable(f"expected {solution} and {tests}, got {sorted(names)}")
    return files


def _attempts(value) -> int:
    try:
        return max(1, min(5, int(value)))
    except (TypeError, ValueError):
        return 3


def _decode(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1].removeprefix("json").strip()
    try:
        written = json.loads(text)
    except json.JSONDecodeError as e:
        raise TaskUnusable("the task was not valid JSON") from e
    if not isinstance(written, dict):
        raise TaskUnusable("the task was not an object")
    return _strip_forbidden(written)


def _strip_forbidden(value):
    if isinstance(value, dict):
        return {k: _strip_forbidden(v) for k, v in value.items() if k not in FORBIDDEN}
    if isinstance(value, list):
        return [_strip_forbidden(v) for v in value]
    return value
