"""The coding round's server side: drafts, attempts, and what reaches the sandbox.

Two rules live here and nowhere else, because both are the kind that quietly stop being
true if they are spread out:

1. **Core decides which files run.** The payload sent to the runner is rebuilt from the
   stored task every time. A draft is merged in only for a file the task marks editable.
2. **An attempt is claimed before it is spent.** The row is written inside a locked
   transaction, so the limit is decided against committed rows rather than against rows
   that will exist once the run finishes.
"""

from __future__ import annotations

import logging
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from apps.interview.config import settings
from apps.interview.models import CodeDraft, CodeRun, InterviewRound, InterviewSession

logger = logging.getLogger(__name__)

DEFAULT_ATTEMPTS_ALLOWED = 3


class TaskMissing(Exception):
    """The round has no generated task for this index or language yet."""


class FileNotEditable(Exception):
    """A draft was offered for a file the candidate does not own."""


class AttemptsExhausted(Exception):
    """The attempt limit for this task is spent."""


def task_for(session_id: str, stage_id: str, task_index: int) -> dict:
    round_ = InterviewRound.objects.filter(session_id=session_id, stage_id=stage_id).first()
    if round_ is None:
        raise TaskMissing(stage_id)
    tasks = (round_.content or {}).get("tasks") or []
    if task_index < 0 or task_index >= len(tasks):
        raise TaskMissing(f"{stage_id}[{task_index}]")
    return tasks[task_index]


def variant_for(task: dict, language: str) -> dict:
    variant = (task.get("languages") or {}).get(language)
    if not variant:
        raise TaskMissing(f"{task.get('title', 'task')}:{language}")
    return variant


def editable_names(task: dict, language: str) -> set[str]:
    variant = variant_for(task, language)
    return {f["name"] for f in variant.get("files", []) if not f.get("readOnly")}


def save_draft(
    *, session_id: str, stage_id: str, task_index: int, language: str, name: str, content: str
) -> CodeDraft:
    task = task_for(session_id, stage_id, task_index)
    if name not in editable_names(task, language):
        raise FileNotEditable(name)

    draft, _ = CodeDraft.objects.update_or_create(
        session_id=session_id,
        stage_id=stage_id,
        task_index=task_index,
        language=language,
        file_name=name,
        defaults={"content": content, "retain_until": _retain_until()},
    )
    return draft


def runner_payload(
    *, session_id: str, stage_id: str, task_index: int, language: str
) -> dict[str, str]:
    """What actually goes into the container.

    Rebuilt from the stored task, with drafts merged in only for editable names. The test
    file is taken verbatim from the task every time, so a draft saved under its name --
    which `save_draft` already refuses -- could not reach the sandbox even if one existed.
    "Read-only" has to be a server rule; as an editor property it is decoration.
    """
    task = task_for(session_id, stage_id, task_index)
    variant = variant_for(task, language)

    files = {f["name"]: f.get("content", "") for f in variant.get("files", [])}
    editable = editable_names(task, language)
    drafts = CodeDraft.objects.filter(
        session_id=session_id, stage_id=stage_id, task_index=task_index, language=language
    )
    for draft in drafts:
        if draft.file_name in editable:
            files[draft.file_name] = draft.content
    return files


def attempts_allowed(task: dict) -> int:
    try:
        return max(1, int(task.get("attemptsAllowed") or DEFAULT_ATTEMPTS_ALLOWED))
    except (TypeError, ValueError):
        return DEFAULT_ATTEMPTS_ALLOWED


def attempts_used(session_id: str, stage_id: str, task_index: int) -> int:
    runs = CodeRun.objects.filter(
        session_id=session_id, stage_id=stage_id, task_index=task_index
    )
    return sum(1 for run in runs if run.counts_as_attempt)


def claim_attempt(
    *, session_id: str, stage_id: str, task_index: int, language: str, files: dict[str, str]
) -> CodeRun:
    """Takes the next attempt, or refuses.

    The session row is locked for the duration so that two simultaneous requests cannot
    both read the same used count. Without the lock the limit is advisory: N requests all
    see room, all pass, and all fork a container -- which is both a bypass of the limit
    and the cheapest way to exhaust the host the Docker socket lives on.
    """
    task = task_for(session_id, stage_id, task_index)
    allowed = attempts_allowed(task)

    with transaction.atomic():
        InterviewSession.objects.select_for_update().filter(id=session_id).first()
        used = attempts_used(session_id, stage_id, task_index)
        if used >= allowed:
            raise AttemptsExhausted(f"{used}/{allowed}")
        return CodeRun.objects.create(
            session_id=session_id,
            stage_id=stage_id,
            task_index=task_index,
            language=language,
            attempt=used + 1,
            files=files,
            phase=CodeRun.Phase.RUNNING,
            retain_until=_retain_until(),
        )


def finish(run: CodeRun, done: dict, terminal: list[dict]) -> CodeRun:
    run.phase = done.get("phase") or CodeRun.Phase.CRASHED
    run.tests = [t for t in done.get("tests") or [] if t.get("name")]
    run.terminal = terminal[-settings.run_terminal_lines :]
    run.exit_code = done.get("exitCode")
    run.duration_ms = int(done.get("durationMs") or 0)
    run.truncated = bool(done.get("truncated"))
    run.timed_out = bool(done.get("timedOut"))
    run.save(
        update_fields=[
            "phase",
            "tests",
            "terminal",
            "exit_code",
            "duration_ms",
            "truncated",
            "timed_out",
            "updated_at",
        ]
    )
    return run


def serialize_run(run: CodeRun) -> dict:
    return {
        "id": run.id,
        "attempt": run.attempt,
        "language": run.language,
        "taskIndex": run.task_index,
        "phase": run.phase,
        "tests": run.tests,
        "terminal": run.terminal,
        "exitCode": run.exit_code,
        "durationMs": run.duration_ms,
        "truncated": run.truncated,
        "timedOut": run.timed_out,
        "countsAsAttempt": run.counts_as_attempt,
        "outcome": run.outcome,
    }


def attempt_state(session_id: str, stage_id: str, task_index: int) -> dict:
    """What the attempts meter and the last-run line render from.

    `lastRunSummary` is derived rather than stored: it is a sentence about numbers that
    already exist, and storing it would let it disagree with them.
    """
    task = task_for(session_id, stage_id, task_index)
    runs = list(
        CodeRun.objects.filter(
            session_id=session_id, stage_id=stage_id, task_index=task_index
        ).order_by("created_at")
    )
    scored = [run for run in runs if run.counts_as_attempt]
    allowed = attempts_allowed(task)

    state = {
        "attemptsAllowed": allowed,
        "attemptsUsed": len(scored),
        "attemptOutcomes": [run.outcome for run in scored][:allowed],
    }
    last = runs[-1] if runs else None
    if last is not None and last.phase == CodeRun.Phase.RAN:
        reported = [t for t in last.tests if t.get("outcome")]
        passed = sum(1 for t in reported if t["outcome"] == "pass")
        state["lastRunSummary"] = f"Last run: {passed} of {len(reported)} tests passed"
    elif last is not None and last.phase == CodeRun.Phase.COMPILE_FAILED:
        state["lastRunSummary"] = "Last run: didn't compile, so no attempt was used"
    return state


def _retain_until():
    return timezone.now() + timedelta(days=settings.code_retention_days)
