"""The resume path end to end: a real upload through importer's endpoint, a real parse
through ingest's parsers, and only the model call stubbed.

Stubbing the parser too would leave the reuse claim untested -- and the page count, which
is the one number here that must come from the document rather than an assertion.
"""

import io
import json

import pytest

from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts

pytestmark = pytest.mark.django_db

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


@pytest.fixture
def uploaded_resume(client, project):
    upload = io.BytesIO(RESUME_TEXT.encode())
    upload.name = "Priya_Raghunathan_Resume.txt"
    response = client.post(
        "/documents/upload",
        data={"project_id": project.id, "file": upload},
    )
    assert response.status_code == 201, response.content
    return response.json()["id"]


def test_attaching_a_resume_reads_it_and_plans_the_rounds(
    client, session, uploaded_resume, fake_plan
):
    response = client.post(
        f"/interview/sessions/{session['id']}/resume",
        data={"documentId": uploaded_resume},
        content_type="application/json",
    )

    assert response.status_code == 201, response.content
    body = response.json()
    assert body["candidate"]["name"] == "Priya Raghunathan"
    assert body["fileName"] == "Priya_Raghunathan_Resume.txt"
    assert body["sizeBytes"] == len(RESUME_TEXT.encode())
    assert body["entityCount"] == 4
    assert [c["id"] for c in body["citations"]] == [1]
    assert body["probes"][0]["round"] == "coding"

    coding = InterviewRound.objects.get(session_id=session["id"], stage_id="coding")
    assert coding.summary == "Retry-safe transfer applier."
    assert coding.citation == 1


def test_the_plan_updates_the_session_and_the_subsequent_get(
    client, session, uploaded_resume, fake_plan
):
    client.post(
        f"/interview/sessions/{session['id']}/resume",
        data={"documentId": uploaded_resume},
        content_type="application/json",
    )

    body = client.get(f"/interview/sessions/{session['id']}").json()
    assert body["candidateName"] == "Priya Raghunathan"
    assert body["resume"]["candidate"]["title"] == "Senior Backend Engineer"
    assert InterviewSession.objects.get(id=session["id"]).resume_document_id == uploaded_resume


def test_page_count_is_omitted_for_a_document_whose_parser_reports_no_pages(
    client, session, uploaded_resume, fake_plan
):
    """A text file has no pages. Asserting a count next to a preview of the document is
    the fabrication this field's optionality exists for."""
    body = client.post(
        f"/interview/sessions/{session['id']}/resume",
        data={"documentId": uploaded_resume},
        content_type="application/json",
    ).json()

    assert "pageCount" not in body
    assert ResumeFacts.objects.get(session_id=session["id"]).page_count is None


def test_reattaching_a_resume_replaces_the_facts_rather_than_duplicating_them(
    client, session, uploaded_resume, fake_plan
):
    for _ in range(2):
        client.post(
            f"/interview/sessions/{session['id']}/resume",
            data={"documentId": uploaded_resume},
            content_type="application/json",
        )

    assert ResumeFacts.objects.filter(session_id=session["id"]).count() == 1


def test_a_document_id_is_required(client, session, fake_plan):
    response = client.post(
        f"/interview/sessions/{session['id']}/resume", data={}, content_type="application/json"
    )
    assert response.status_code == 400


def test_a_document_from_another_project_is_not_found(client, session, fake_plan):
    response = client.post(
        f"/interview/sessions/{session['id']}/resume",
        data={"documentId": "d" * 24},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_a_resume_with_no_readable_text_is_rejected(client, session, project, fake_plan):
    empty = io.BytesIO(b"   \n  ")
    empty.name = "blank.txt"
    document_id = client.post(
        "/documents/upload", data={"project_id": project.id, "file": empty}
    ).json()["id"]

    response = client.post(
        f"/interview/sessions/{session['id']}/resume",
        data={"documentId": document_id},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert not ResumeFacts.objects.exists()


def test_a_model_failure_is_a_502_not_a_client_error(client, session, uploaded_resume, monkeypatch):
    async def explode(**kwargs):
        raise RuntimeError("anthropic: overloaded_error")

    monkeypatch.setattr("apps.interview.resume.complete", explode)

    response = client.post(
        f"/interview/sessions/{session['id']}/resume",
        data={"documentId": uploaded_resume},
        content_type="application/json",
    )
    assert response.status_code == 502
    assert "anthropic" not in response.json()["detail"]
