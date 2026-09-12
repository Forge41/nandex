import pytest
from django.test import Client

from apps.core.models import Project
from apps.interview import workflow_client


@pytest.fixture
def client(db) -> Client:
    """A browser-shaped client. The first request auto-provisions an anonymous identity,
    which is how a candidate gets one -- there is no login."""
    c = Client()
    c.get("/auth/session")
    return c


@pytest.fixture
def other_client(db) -> Client:
    """A second, unrelated visitor. Its own cookie means its own identity."""
    c = Client()
    c.get("/auth/session")
    return c


@pytest.fixture
def project(client) -> Project:
    return Project.objects.first()


@pytest.fixture
def session(client):
    response = client.post(
        "/interview/sessions",
        data={"roleTitle": "Senior Backend Engineer — Payments"},
        content_type="application/json",
    )
    assert response.status_code == 201, response.content
    return response.json()


@pytest.fixture
def fake_room(monkeypatch):
    """Stands in for tps and vas. Records what it was asked for, so a test can assert the
    identity and grants rather than trusting them."""
    # vas ids are secrets.token_hex(12) -- 24 characters, exactly what the CharField
    # holds. A shorter stand-in would let a length bug through.
    vas_session_id = "a" * 24
    calls = {
        "tokens": [],
        "sessions": [],
        "starts": [],
        "stops": [],
        "vas_session_id": vas_session_id,
    }

    async def mint_join_token(project_id, room, identity, **kwargs):
        calls["tokens"].append(
            {"project_id": project_id, "room": room, "identity": identity, **kwargs}
        )
        return {"token": "jwt-for-" + identity, "ws_url": "ws://livekit.test", "expires_in": 900}

    async def ensure_artifact_session(
        external_session_id, room_name, metadata=None, auto_record=False
    ):
        calls["sessions"].append((external_session_id, room_name, auto_record))
        return vas_session_id

    async def start_recording(vas_session_id, **kwargs):
        calls["starts"].append(vas_session_id)
        return {"id": "rec-1", "status": "starting"}

    async def stop_recording(vas_session_id, recording_id=None):
        calls["stops"].append(vas_session_id)
        return {"id": "rec-1", "status": "ending"}

    from apps.core.services import room_service

    monkeypatch.setattr(room_service, "mint_join_token", mint_join_token)
    monkeypatch.setattr(room_service, "ensure_artifact_session", ensure_artifact_session)
    monkeypatch.setattr(room_service, "start_recording", start_recording)
    monkeypatch.setattr(room_service, "stop_recording", stop_recording)
    return calls


@pytest.fixture(autouse=True)
def workflows(monkeypatch):
    """Records what the HTTP layer asked the session's workflow to do.

    Autouse so no test spends a Temporal connect timeout, and recorded rather than
    silenced because "the browser advanced a round" reaching the workflow is a property
    worth asserting -- it is what keeps the lookahead running.
    """
    calls = {"started": [], "reached": [], "ended": [], "progress": None}

    async def start_plan(session_id, document_id):
        calls["started"].append((session_id, document_id))
        return True

    async def round_reached(session_id, stage_id):
        calls["reached"].append((session_id, stage_id))

    async def session_ended(session_id):
        calls["ended"].append(session_id)

    async def plan_progress(session_id):
        return calls["progress"]

    monkeypatch.setattr(workflow_client, "start_plan", start_plan)
    monkeypatch.setattr(workflow_client, "round_reached", round_reached)
    monkeypatch.setattr(workflow_client, "session_ended", session_ended)
    monkeypatch.setattr(workflow_client, "plan_progress", plan_progress)
    return calls
