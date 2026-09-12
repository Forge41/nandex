"""The workflow, against a real Temporal server and a real worker.

Only the model is stubbed. The properties here -- that page two opens on the index rather
than waiting for round content, that the lookahead prepares two rounds and no more, that
one round failing leaves its sibling alone -- are all about how the steps are ordered
against each other, which a test with a faked workflow could not observe.
"""

import asyncio
import io
import json
import uuid

import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from apps.interview.activities import (
    generate_plan_activity,
    generate_round_content_activity,
    parse_resume_activity,
    rounds_needing_content_activity,
    set_plan_state_activity,
)
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts
from apps.interview.workflows import InterviewSessionWorkflow, lookahead_from

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.asyncio]

RESUME_TEXT = "Priya Raghunathan\nOwned the ledger handling 1.4M transactions a day.\n"

PLAN = {
    "candidate": {"name": "Priya Raghunathan", "title": "Senior Backend Engineer"},
    "citations": [{"id": 1, "quote": "1.4M transactions a day", "source": "Experience"}],
    "sections": [
        {
            "id": "experience",
            "label": "Experience",
            "paragraphs": [[{"text": "Owned the ledger handling "}, {"text": "1.4M transactions a day", "citation": 1}]],
        }
    ],
    "probes": [
        {"id": "p1", "title": "Ledger scale", "note": "Worth grounding", "citation": 1, "round": "behavioral"},
        {"id": "p2", "title": "Retry safety", "note": "Core to the role", "citation": 1, "round": "coding"},
    ],
    "rounds": [
        {"id": "behavioral", "citation": 1, "summary": "Probe the ledger decision."},
        {"id": "coding", "citation": 1, "summary": "Retry-safe transfer applier."},
    ],
    "entityCount": 4,
}

QUESTION = {
    "question": "Walk me through the moment you knew the single writer would not hold.",
    "derivedFrom": ["the ledger migration"],
    "citation": 1,
}


class FakeModel:
    """One stub for both prompts, told apart by the system prompt they were given.

    `round_gate` holds round-content generation open so a test can look at the world
    between the plan landing and the rounds landing -- with an instant model there is no
    such moment to catch by polling.
    """

    def __init__(self) -> None:
        self.prompts: list[str] = []
        self.round_gate = asyncio.Event()
        self.round_gate.set()

    async def complete(self, *, system_prompt, messages, model):
        self.prompts.append(system_prompt)
        if "behavioral round" in system_prompt:
            await self.round_gate.wait()
            return json.dumps(QUESTION)
        return json.dumps(PLAN)


@pytest.fixture
def fake_model(monkeypatch):
    model = FakeModel()
    monkeypatch.setattr("apps.interview.resume.complete", model.complete)
    monkeypatch.setattr("apps.interview.round_content.complete", model.complete)
    return model


@pytest.fixture
async def temporal_env():
    env = await WorkflowEnvironment.start_local()
    yield env
    await env.shutdown()


@pytest.fixture
def blank_resume(client, project):
    # A fixture, not an inline upload: the test client is synchronous and reaches
    # Django's session store, which cannot run on the event loop these tests use.
    blank = io.BytesIO(b"   \n ")
    blank.name = "blank.txt"
    response = client.post("/documents/upload", data={"project_id": project.id, "file": blank})
    assert response.status_code == 201, response.content
    return response.json()["id"]


@pytest.fixture
def uploaded_resume(client, project):
    upload = io.BytesIO(RESUME_TEXT.encode())
    upload.name = "Priya_Raghunathan_Resume.txt"
    response = client.post("/documents/upload", data={"project_id": project.id, "file": upload})
    assert response.status_code == 201, response.content
    return response.json()["id"]


def _worker(env, task_queue: str) -> Worker:
    return Worker(
        env.client,
        task_queue=task_queue,
        workflows=[InterviewSessionWorkflow],
        activities=[
            parse_resume_activity,
            generate_plan_activity,
            generate_round_content_activity,
            rounds_needing_content_activity,
            set_plan_state_activity,
        ],
    )


async def _start(env, session_id: str, document_id: str):
    queue = f"test-interview-{uuid.uuid4().hex[:8]}"
    worker = _worker(env, queue)
    handle = await env.client.start_workflow(
        InterviewSessionWorkflow.run,
        args=[session_id, document_id],
        id=f"interview-session-{session_id}",
        task_queue=queue,
    )
    return worker, handle


async def _wait_for(predicate, *, timeout: float = 20.0):
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        result = await predicate()
        if result:
            return result
        await asyncio.sleep(0.1)
    raise AssertionError("condition never held")


async def test_the_lookahead_is_the_next_two_rounds_in_order():
    assert lookahead_from("resume") == ["behavioral", "coding"]
    assert lookahead_from("behavioral") == ["coding", "sql"]
    # The last round has nothing after it, and an unknown stage is not a round at all.
    assert lookahead_from("wrap") == []
    assert lookahead_from("nonsense") == []


async def test_the_plan_is_ready_before_any_round_content_is(
    temporal_env, session, uploaded_resume, fake_model
):
    """The whole index-first design rests on this: page two is the index, and holding it
    back for task generation is the wait this removes."""
    # Held open so there is an observable moment between the two.
    fake_model.round_gate.clear()

    worker, handle = await _start(temporal_env, session["id"], uploaded_resume)
    async with worker:
        await _wait_for(
            lambda: InterviewSession.objects.filter(
                id=session["id"], plan_state="ready"
            ).acount()
        )
        ready_at_plan = await InterviewRound.objects.filter(
            session_id=session["id"], stage_id="behavioral", content_state="ready"
        ).acount()

        fake_model.round_gate.set()
        await _wait_for(
            lambda: InterviewRound.objects.filter(
                session_id=session["id"], stage_id="behavioral", content_state="ready"
            ).acount()
        )
        await handle.signal(InterviewSessionWorkflow.session_ended)
        await handle.result()

    assert ready_at_plan == 0
    facts = await ResumeFacts.objects.aget(session_id=session["id"])
    assert facts.candidate_name == "Priya Raghunathan"


async def test_the_steps_describe_this_resume_and_not_a_template(
    temporal_env, session, uploaded_resume, fake_model
):
    worker, handle = await _start(temporal_env, session["id"], uploaded_resume)
    async with worker:
        await _wait_for(
            lambda: InterviewRound.objects.filter(
                session_id=session["id"], stage_id="behavioral", content_state="ready"
            ).acount()
        )
        progress = await handle.query("progress")
        await handle.signal(InterviewSessionWorkflow.session_ended)
        await handle.result()

    steps = {step["id"]: step for step in progress["steps"]}
    assert progress["status"] == "ready"
    # The document's own name, read off the upload rather than declared anywhere.
    assert steps["parse"]["detail"] == "Priya_Raghunathan_Resume.txt"
    # The plan's own counts: two probes, over the two rounds it actually spoke about.
    assert steps["plan"]["detail"] == "2 probes across 2 rounds"
    assert all(step["state"] == "done" for step in progress["steps"])

    # Only rounds something can write are listed -- coding has no generator yet, so a
    # step for it would tick off having produced nothing.
    round_steps = [s for s in progress["steps"] if s["id"].startswith("round:")]
    assert [s["id"] for s in round_steps] == ["round:behavioral"]
    assert round_steps[0]["label"].startswith("Preparing ")


async def test_the_generated_question_is_written_from_the_resume(
    temporal_env, session, uploaded_resume, fake_model
):
    worker, handle = await _start(temporal_env, session["id"], uploaded_resume)
    async with worker:
        await _wait_for(
            lambda: InterviewRound.objects.filter(
                session_id=session["id"], stage_id="behavioral", content_state="ready"
            ).acount()
        )
        await handle.signal(InterviewSessionWorkflow.session_ended)
        await handle.result()

    round_ = await InterviewRound.objects.aget(session_id=session["id"], stage_id="behavioral")
    assert round_.content["question"] == QUESTION["question"]
    assert round_.content["derivedFrom"] == ["the ledger migration"]
    assert round_.content["citation"] == 1
    # Never a total the round has not got: the interviewer follows up live, so how many
    # questions there will be is not knowable here.
    assert "questionTotal" not in round_.content


async def test_reaching_a_round_prepares_the_ones_after_it(
    temporal_env, session, uploaded_resume, fake_model, monkeypatch
):
    """The rolling window: arriving somewhere is what pays for what comes next."""
    monkeypatch.setattr(
        "apps.interview.round_content.GENERATABLE_STAGE_IDS",
        frozenset({"behavioral", "coding", "sql", "debug"}),
    )

    worker, handle = await _start(temporal_env, session["id"], uploaded_resume)
    async with worker:
        async def both_ready():
            return (
                await InterviewRound.objects.filter(
                    session_id=session["id"],
                    stage_id__in=["behavioral", "coding"],
                    content_state="ready",
                ).acount()
                == 2
            )

        await _wait_for(both_ready)
        # Nothing beyond the window before the candidate moves.
        assert (
            await InterviewRound.objects.filter(
                session_id=session["id"], stage_id="sql", content_state="ready"
            ).acount()
            == 0
        )

        await handle.signal(InterviewSessionWorkflow.round_reached, "behavioral")
        await _wait_for(
            lambda: InterviewRound.objects.filter(
                session_id=session["id"], stage_id="sql", content_state="ready"
            ).acount()
        )
        # coding was already prepared, so reaching behavioral only bought sql -- one
        # model call, not two.
        assert (
            await InterviewRound.objects.filter(
                session_id=session["id"], stage_id="debug", content_state="ready"
            ).acount()
            == 0
        )
        await handle.signal(InterviewSessionWorkflow.session_ended)
        await handle.result()


async def test_an_unreadable_resume_stops_the_run_and_says_why(
    temporal_env, session, blank_resume, fake_model
):
    worker, handle = await _start(temporal_env, session["id"], blank_resume)
    async with worker:
        await handle.result()
        progress = await handle.query("progress")

    stored = await InterviewSession.objects.aget(id=session["id"])
    assert stored.plan_state == "failed"
    # The candidate's own file is theirs to fix, so they are told what is wrong with it.
    assert "no readable text" in stored.plan_error
    assert progress["steps"][1]["state"] == "running"


async def test_a_model_outage_is_not_explained_to_the_candidate(
    temporal_env, session, uploaded_resume, monkeypatch
):
    async def explode(**kwargs):
        raise RuntimeError("anthropic: overloaded_error")

    monkeypatch.setattr("apps.interview.resume.complete", explode)

    worker, handle = await _start(temporal_env, session["id"], uploaded_resume)
    async with worker:
        await handle.result()

    stored = await InterviewSession.objects.aget(id=session["id"])
    assert stored.plan_state == "failed"
    assert "anthropic" not in stored.plan_error
