"""Reading a resume and planning from it, at the layer that now does the work.

A real upload through importer, a real parse through ingest's parsers, and only the model
call stubbed. Stubbing the parser too would leave the reuse claim untested -- and the page
count, which is the one number here that must come from the document rather than an
assertion.
"""

import io
import json

import pytest

from apps.interview.activities import (
    generate_plan_activity,
    parse_resume_activity,
    rounds_needing_content_activity,
)
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts
from apps.interview.resume import ResumeUnreadable

# transaction=True because these are async: the sync fixtures that create the session and
# upload the document write on a different connection, and an uncommitted transaction is
# invisible to the async ORM the activities use.
pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.asyncio]

RESUME_TEXT = (
    "Priya Raghunathan\nSenior Backend Engineer, Bengaluru\n\n"
    "Owned the double-entry ledger handling 1.4M transactions a day at Northwind.\n"
)

PLAN = {
    "candidate": {
        "name": "Priya Raghunathan",
        "title": "Senior Backend Engineer",
        "location": "Bengaluru",
        "email": "priya@example.com",
        "yearsExperience": 6,
    },
    "citations": [{"id": 1, "quote": "1.4M transactions a day", "source": "Experience"}],
    "sections": [
        {
            "id": "experience",
            "label": "Experience",
            "paragraphs": [
                [
                    {"text": "Owned the double-entry ledger handling "},
                    {"text": "1.4M transactions a day", "citation": 1},
                    {"text": " at Northwind."},
                ]
            ],
        }
    ],
    "probes": [
        {
            "id": "p1",
            "title": "Ledger at 1.4M/day",
            "note": "Scale claim worth grounding",
            "citation": 1,
            "round": "coding",
        }
    ],
    "rounds": [{"id": "coding", "citation": 1, "summary": "Retry-safe transfer applier."}],
    "entityCount": 4,
}


@pytest.fixture
def fake_plan(monkeypatch):
    async def complete(*, system_prompt, messages, model):
        # The prompt must be the file's contents, not an f-string assembled here.
        assert "Return only JSON" in system_prompt
        assert messages[0]["content"].strip()
        return json.dumps(PLAN)

    monkeypatch.setattr("apps.interview.resume.complete", complete)


def _upload(client, project, text: bytes, name: str) -> str:
    upload = io.BytesIO(text)
    upload.name = name
    response = client.post("/documents/upload", data={"project_id": project.id, "file": upload})
    assert response.status_code == 201, response.content
    return response.json()["id"]


@pytest.fixture
def uploaded_resume(client, project):
    return _upload(client, project, RESUME_TEXT.encode(), "Priya_Raghunathan_Resume.txt")


@pytest.fixture
def blank_resume(client, project):
    # A fixture rather than an inline upload: the test client is synchronous, and calling
    # it from inside an async test reaches Django's session store on the event loop.
    return _upload(client, project, b"   \n  ", "blank.txt")


async def _plan(session_id: str, document_id: str) -> dict:
    parsed = await parse_resume_activity(session_id, document_id)
    return await generate_plan_activity(session_id, parsed)


async def test_parsing_reports_the_document_as_it_really_is(session, uploaded_resume, fake_plan):
    parsed = await parse_resume_activity(session["id"], uploaded_resume)

    assert parsed["file_name"] == "Priya_Raghunathan_Resume.txt"
    assert parsed["size_bytes"] == len(RESUME_TEXT.encode())
    assert "1.4M transactions a day" in parsed["text"]
    # A text file has no pages. Asserting a count next to a preview of the document is
    # the fabrication this field's optionality exists for.
    assert parsed["page_count"] is None


async def test_planning_writes_the_facts_and_the_round_summaries(
    session, uploaded_resume, fake_plan
):
    result = await _plan(session["id"], uploaded_resume)

    facts = await ResumeFacts.objects.aget(session_id=session["id"])
    assert facts.candidate_name == "Priya Raghunathan"
    assert facts.entity_count == 4
    assert facts.page_count is None

    coding = await InterviewRound.objects.aget(session_id=session["id"], stage_id="coding")
    assert coding.summary == "Retry-safe transfer applier."
    assert coding.citation == 1

    # What the workflow needs to describe itself, and nothing more.
    assert result["probe_count"] == 1
    assert result["rounds"] == [{"stageId": "coding", "label": coding.label}]


async def test_the_candidates_own_name_reaches_the_session(session, uploaded_resume, fake_plan):
    await _plan(session["id"], uploaded_resume)

    stored = await InterviewSession.objects.aget(id=session["id"])
    assert stored.candidate_name == "Priya Raghunathan"
    assert stored.resume_document_id == uploaded_resume


async def test_a_finished_plan_moves_the_session_to_the_round_that_shows_it(
    session, uploaded_resume, fake_plan
):
    """Written server-side so a refresh lands on the plan rather than back at the
    dropzone the candidate has already used."""
    assert session["activeStage"] == "preflight"

    await _plan(session["id"], uploaded_resume)

    stored = await InterviewSession.objects.aget(id=session["id"])
    assert stored.active_stage == "resume"
    assert stored.progress_index == 1


async def test_replanning_does_not_drag_a_candidate_back_to_the_plan(
    session, uploaded_resume, fake_plan
):
    await InterviewSession.objects.filter(id=session["id"]).aupdate(
        active_stage="coding", progress_index=3
    )

    await _plan(session["id"], uploaded_resume)

    stored = await InterviewSession.objects.aget(id=session["id"])
    assert stored.active_stage == "coding"
    assert stored.progress_index == 3


async def test_replanning_replaces_the_facts_rather_than_duplicating_them(
    session, uploaded_resume, fake_plan
):
    for _ in range(2):
        await _plan(session["id"], uploaded_resume)

    assert await ResumeFacts.objects.filter(session_id=session["id"]).acount() == 1


async def test_a_document_from_another_project_cannot_be_read(session, fake_plan):
    with pytest.raises(ResumeUnreadable):
        await parse_resume_activity(session["id"], "d" * 24)


async def test_a_resume_with_no_readable_text_is_rejected(session, blank_resume, fake_plan):
    with pytest.raises(ResumeUnreadable):
        await parse_resume_activity(session["id"], blank_resume)

    assert await ResumeFacts.objects.acount() == 0


async def test_a_model_failure_reaches_the_workflow_rather_than_being_swallowed(
    session, uploaded_resume, monkeypatch
):
    """The workflow decides what a failed plan means; an activity that hid it would leave
    the candidate watching a step that never finishes."""

    async def explode(**kwargs):
        raise RuntimeError("anthropic: overloaded_error")

    monkeypatch.setattr("apps.interview.resume.complete", explode)

    with pytest.raises(RuntimeError):
        await _plan(session["id"], uploaded_resume)


async def test_only_rounds_with_a_generator_are_offered_for_preparing(session):
    """A stage nothing can write yet must not be queued as work: it would show the
    candidate a step that ticks off having produced nothing."""
    wanted = await rounds_needing_content_activity(session["id"], ["behavioral", "coding"])

    assert [r["stageId"] for r in wanted] == ["behavioral"]
    assert wanted[0]["label"]


async def test_a_round_already_prepared_is_not_offered_again(session):
    await InterviewRound.objects.filter(session_id=session["id"], stage_id="behavioral").aupdate(
        content_state=InterviewRound.ContentState.READY
    )

    assert await rounds_needing_content_activity(session["id"], ["behavioral"]) == []
