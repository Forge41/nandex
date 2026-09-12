"""The workflow that owns a session's generated content, start to finish.

One workflow per interview, started when the resume arrives and ended when the session
is. It holds the progress the candidate watches, because the account of what is being
done belongs with the thing doing it -- a step list duplicated in the database or the
browser is a second version of the same story, free to disagree with the first.
"""

import asyncio
from dataclasses import asdict, dataclass, field
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError, ApplicationError

with workflow.unsafe.imports_passed_through():
    from apps.interview.activities import (
        generate_plan_activity,
        generate_round_content_activity,
        parse_resume_activity,
        rounds_needing_content_activity,
        set_plan_state_activity,
    )
    from apps.interview.rounds import STAGE_IDS

# An interview nobody ends should not leave a workflow waiting for a signal that is
# never coming. Generously longer than the longest interview, because the cost of waking
# early is losing the lookahead for a candidate who is simply taking their time.
IDLE_LIMIT = timedelta(hours=6)

# How far ahead of the candidate content is prepared. Two, so the round they are in and
# the one after it are both ready before they can reach either -- rounds unlock one at a
# time, so they cannot outrun this.
LOOKAHEAD = 2

PENDING = "pending"
RUNNING = "running"
DONE = "done"
FAILED = "failed"

# A bad file does not become readable on a second attempt, and a deleted session does not
# come back. Retrying either just delays the error the candidate is waiting for.
_PERMANENT = ["ResumeUnreadable", "SessionGone"]

_PARSE_RETRY = RetryPolicy(maximum_attempts=2, non_retryable_error_types=_PERMANENT)
_MODEL_RETRY = RetryPolicy(maximum_attempts=3, non_retryable_error_types=_PERMANENT)


@dataclass
class PlanStep:
    id: str
    label: str
    detail: str = ""
    state: str = PENDING


@dataclass
class _Progress:
    status: str = "processing"
    error: str = ""
    steps: list[PlanStep] = field(default_factory=list)


def lookahead_from(stage_id: str, count: int = LOOKAHEAD) -> list[str]:
    """The next `count` stages after `stage_id`, in interview order."""
    if stage_id not in STAGE_IDS:
        return []
    start = STAGE_IDS.index(stage_id) + 1
    return list(STAGE_IDS[start : start + count])


@workflow.defn(name="InterviewSessionWorkflow")
class InterviewSessionWorkflow:
    def __init__(self) -> None:
        self._progress = _Progress()
        self._reached: list[str] = []
        self._ended = False

    @workflow.query(name="progress")
    def progress(self) -> dict:
        return {
            "status": self._progress.status,
            "error": self._progress.error,
            "steps": [asdict(step) for step in self._progress.steps],
        }

    @workflow.signal(name="round_reached")
    def round_reached(self, stage_id: str) -> None:
        self._reached.append(stage_id)

    @workflow.signal(name="session_ended")
    def session_ended(self) -> None:
        self._ended = True

    @workflow.run
    async def run(self, session_id: str, document_id: str = "") -> None:
        # An /end signal can start this workflow for a session that never uploaded a
        # resume, in which case there is no plan to build -- only the ending to wait for.
        if document_id and not await self._build_plan(session_id, document_id):
            # No plan means no rounds to prepare, so there is nothing left to wait for.
            return

        while not self._ended:
            try:
                await workflow.wait_condition(
                    lambda: bool(self._reached) or self._ended, timeout=IDLE_LIMIT
                )
            except TimeoutError:
                return
            while self._reached:
                await self._prepare(session_id, lookahead_from(self._reached.pop(0)))

    async def _build_plan(self, session_id: str, document_id: str) -> bool:
        self._progress.steps = [
            # Already done by the time this workflow exists: it is started by the request
            # that received the file.
            PlanStep("upload", "Uploading your resume", state=DONE),
            PlanStep("parse", "Reading the document"),
            PlanStep("plan", "Building your interview plan"),
        ]

        try:
            parsed = await self._run_step(
                "parse",
                parse_resume_activity,
                [session_id, document_id],
                timeout=timedelta(minutes=2),
                retry=_PARSE_RETRY,
            )
            self._step("parse").detail = _document_detail(parsed)

            plan = await self._run_step(
                "plan",
                generate_plan_activity,
                [session_id, parsed],
                timeout=timedelta(minutes=5),
                retry=_MODEL_RETRY,
            )
            self._step("plan").detail = _plan_detail(plan)
        except ActivityError as e:
            self._progress.status = FAILED
            self._progress.error = _candidate_facing(e)
            await self._set_state(session_id, FAILED, self._progress.error)
            return False

        # Ready before any round detail exists: page two is the index, and holding it
        # back for seven task generations is the wait this design removes.
        self._progress.status = "ready"
        await self._set_state(session_id, "ready")
        await self._prepare(session_id, lookahead_from("resume"))
        return True

    async def _prepare(self, session_id: str, stage_ids: list[str]) -> None:
        if not stage_ids:
            return
        wanted = await workflow.execute_activity(
            rounds_needing_content_activity,
            args=[session_id, stage_ids],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=_MODEL_RETRY,
        )
        if not wanted:
            return

        for round_ in wanted:
            self._progress.steps.append(
                PlanStep(
                    f"round:{round_['stageId']}", f"Preparing {round_['label']}", state=RUNNING
                )
            )

        # Independent rounds, so they run together -- and gathered here rather than
        # inside one activity so a failure on one retries and fails alone.
        results = await asyncio.gather(
            *(
                workflow.execute_activity(
                    generate_round_content_activity,
                    args=[session_id, round_["stageId"]],
                    start_to_close_timeout=timedelta(minutes=5),
                    retry_policy=_MODEL_RETRY,
                )
                for round_ in wanted
            ),
            return_exceptions=True,
        )

        for round_, result in zip(wanted, results, strict=True):
            step = self._step(f"round:{round_['stageId']}")
            step.state = FAILED if isinstance(result, BaseException) else DONE

    async def _run_step(self, step_id: str, fn, args: list, *, timeout, retry):
        self._step(step_id).state = RUNNING
        result = await workflow.execute_activity(
            fn, args=args, start_to_close_timeout=timeout, retry_policy=retry
        )
        self._step(step_id).state = DONE
        return result

    async def _set_state(self, session_id: str, state: str, error: str = "") -> None:
        await workflow.execute_activity(
            set_plan_state_activity,
            args=[session_id, state, error],
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(maximum_attempts=5, non_retryable_error_types=_PERMANENT),
        )

    def _step(self, step_id: str) -> PlanStep:
        for step in self._progress.steps:
            if step.id == step_id:
                return step
        raise KeyError(step_id)


def _document_detail(parsed: dict) -> str:
    pages = parsed.get("page_count")
    name = parsed.get("file_name") or "resume"
    return f"{name} · {pages} pages" if pages else name


def _plan_detail(plan: dict) -> str:
    probes = plan.get("probe_count", 0)
    rounds = len(plan.get("rounds") or ())
    return f"{probes} {_plural(probes, 'probe')} across {rounds} {_plural(rounds, 'round')}"


def _plural(count: int, noun: str) -> str:
    return noun if count == 1 else f"{noun}s"


def _candidate_facing(error: ActivityError) -> str:
    """The candidate is told why only when the reason is theirs to act on.

    Anything else -- a model outage, a bug -- reaches them as one sentence, because the
    detail belongs in the log and an upstream message is not ours to forward.
    """
    cause = error.cause
    if isinstance(cause, ApplicationError) and cause.type == "ResumeUnreadable":
        return str(cause.message)
    return "We couldn't read that resume. Try uploading it again."
