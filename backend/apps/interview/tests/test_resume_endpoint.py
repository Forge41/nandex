"""The HTTP surface for handing over a resume.

The endpoint's whole job is now to take the file, remember it, and hand the work to the
workflow -- so what these pin is that it answers immediately and that nothing it accepts
depends on the browser knowing a project id.
"""

import io

import pytest

from apps.interview.models import InterviewSession

pytestmark = pytest.mark.django_db

RESUME = b"Priya Raghunathan\nSenior Backend Engineer\n"


def _file(name: str = "resume.txt", body: bytes = RESUME) -> io.BytesIO:
    upload = io.BytesIO(body)
    upload.name = name
    return upload


def test_a_resume_is_accepted_and_the_work_handed_over(client, session, workflows):
    response = client.post(f"/interview/sessions/{session['id']}/resume", data={"file": _file()})

    assert response.status_code == 202, response.content
    body = response.json()
    assert body["planState"] == "processing"
    # The plan is not in the answer, because it does not exist yet.
    assert body["resume"] is None

    started = workflows["started"]
    assert len(started) == 1
    assert started[0][0] == session["id"]
    assert started[0][1] == InterviewSession.objects.get(id=session["id"]).resume_document_id


def test_the_project_comes_from_the_session_not_the_caller(client, session, project, workflows):
    """The browser is never told a project id, so it cannot be asked for one -- and one
    it did send would have to be checked against the session anyway."""
    client.post(f"/interview/sessions/{session['id']}/resume", data={"file": _file()})

    document_id = InterviewSession.objects.get(id=session["id"]).resume_document_id
    from apps.importer.models import RawDocument

    assert RawDocument.objects.get(id=document_id).project_id == project.id


def test_an_interview_resume_is_not_pushed_into_the_search_index(client, session, monkeypatch):
    """A candidate's resume belongs to one interview, not to the workspace's corpus."""
    started = []

    async def trigger(raw_document_id):
        started.append(raw_document_id)

    monkeypatch.setattr("apps.importer.uploads._trigger_ingest", trigger)
    client.post(f"/interview/sessions/{session['id']}/resume", data={"file": _file()})

    assert started == []


def test_an_unsupported_file_is_refused_before_any_work_starts(client, session, workflows):
    response = client.post(
        f"/interview/sessions/{session['id']}/resume",
        data={"file": _file("resume.exe", b"MZ\x00")},
    )

    assert response.status_code == 400
    assert workflows["started"] == []
    assert InterviewSession.objects.get(id=session["id"]).plan_state == "idle"


def test_a_request_with_no_file_is_a_client_error(client, session):
    response = client.post(f"/interview/sessions/{session['id']}/resume", data={})
    assert response.status_code == 400


def test_a_workflow_that_cannot_be_started_leaves_the_session_saying_so(
    client, session, workflows, monkeypatch
):
    """Not a spinner: a candidate whose resume was never picked up has to be able to
    retry, which means the failure has to be on the session rather than only in a log."""

    async def refuse(session_id, document_id):
        return False

    monkeypatch.setattr("apps.interview.workflow_client.start_plan", refuse)

    response = client.post(f"/interview/sessions/{session['id']}/resume", data={"file": _file()})

    assert response.status_code == 502
    stored = InterviewSession.objects.get(id=session["id"])
    assert stored.plan_state == "failed"
    assert stored.plan_error


def test_another_visitor_cannot_attach_a_resume(other_client, session):
    response = other_client.post(
        f"/interview/sessions/{session['id']}/resume", data={"file": _file()}
    )
    assert response.status_code == 404


def test_the_uploaded_document_is_served_back_for_the_plan_screen(client, session):
    client.post(f"/interview/sessions/{session['id']}/resume", data={"file": _file()})

    response = client.get(f"/interview/sessions/{session['id']}/resume/file")

    assert response.status_code == 200
    assert b"".join(response.streaming_content) == RESUME


def test_another_visitor_cannot_read_the_document(client, other_client, session):
    client.post(f"/interview/sessions/{session['id']}/resume", data={"file": _file()})

    assert other_client.get(f"/interview/sessions/{session['id']}/resume/file").status_code == 404


def test_a_session_with_no_resume_has_no_document_to_serve(client, session):
    assert client.get(f"/interview/sessions/{session['id']}/resume/file").status_code == 404
