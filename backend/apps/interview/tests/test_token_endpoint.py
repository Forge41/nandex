"""The token endpoint is the authorization-critical path: it hands the browser a
credential for a real-time room. These tests are about who gets which token, not about
the happy path.
"""

import pytest

from apps.interview.models import InterviewSession, candidate_identity_for

pytestmark = pytest.mark.django_db


def test_the_identity_is_derived_server_side_and_a_body_cannot_choose_it(
    client, session, fake_room
):
    """The single most important property of this endpoint. A browser that could name its
    own identity could join as the interviewer, or as another candidate."""
    response = client.post(
        f"/interview/sessions/{session['id']}/token",
        data={"identity": "interviewer-evil", "room": "some-other-room"},
        content_type="application/json",
    )

    assert response.status_code == 200
    body = response.json()
    assert body["identity"] == candidate_identity_for(session["id"])
    assert body["room_name"] == f"interview-{session['id']}"

    minted = fake_room["tokens"][0]
    assert minted["identity"] == candidate_identity_for(session["id"])
    assert minted["room"] == f"interview-{session['id']}"


def test_an_anonymous_caller_gets_401(db, session, fake_room):
    """A client with no cookie at all -- the auto-provision middleware gives it a fresh
    identity, which owns no session, so this is a 404 rather than a token."""
    from django.test import Client

    response = Client().post(f"/interview/sessions/{session['id']}/token")
    assert response.status_code == 404


def test_another_visitors_session_is_not_found_rather_than_forbidden(
    other_client, session, fake_room
):
    """404, not 403: a 403 would confirm the session exists."""
    response = other_client.post(f"/interview/sessions/{session['id']}/token")

    assert response.status_code == 404
    assert fake_room["tokens"] == []


def test_a_token_carries_an_agent_dispatch_so_an_interviewer_actually_joins(
    client, session, fake_room
):
    client.post(f"/interview/sessions/{session['id']}/token")

    agents = fake_room["tokens"][0]["agents"]
    assert [name for name, _ in agents] == ["interviewer"]
    metadata = agents[0][1]
    assert session["id"] in metadata


def test_an_ended_session_will_not_mint_a_token(client, session, fake_room):
    client.post(f"/interview/sessions/{session['id']}/end")

    response = client.post(f"/interview/sessions/{session['id']}/token")
    assert response.status_code == 409
    assert fake_room["tokens"] == []


def test_a_room_failure_is_a_502_with_no_upstream_detail(client, session, monkeypatch):
    from apps.core.services import room_service

    async def explode(*args, **kwargs):
        raise room_service.RoomUnavailable("grpc: connection refused to localhost:50051")

    monkeypatch.setattr(room_service, "mint_join_token", explode)

    response = client.post(f"/interview/sessions/{session['id']}/token")
    assert response.status_code == 502
    assert "grpc" not in response.json()["detail"]
    assert "50051" not in response.json()["detail"]


def _consent_to_recording(client, session_id: str) -> None:
    client.patch(
        f"/interview/sessions/{session_id}",
        data={"consent": {"recording": True}},
        content_type="application/json",
    )


def test_recording_is_armed_not_started_when_consent_was_given(client, session, fake_room):
    """The design has no record button and its consent text promises integrity monitoring
    during timed tasks, so a click-driven trigger would let a candidate silently decline.

    But "on first join" is not "at token mint": a provider room does not exist until its
    first participant joins, and Egress answers not_found for a room that isn't there. So
    the token arms the recording and the video service starts it on room_started.
    """
    _consent_to_recording(client, session["id"])

    response = client.post(f"/interview/sessions/{session['id']}/token")

    assert response.json()["recording_state"] == "armed"
    assert fake_room["sessions"] == [(session["id"], f"interview-{session['id']}", True)]
    # Deliberately not started here -- there is no room yet to record.
    assert fake_room["starts"] == []


def test_recording_is_not_armed_without_consent(client, session, fake_room):
    response = client.post(f"/interview/sessions/{session['id']}/token")

    assert response.json()["recording_state"] == "off"
    assert fake_room["sessions"] == []


def test_a_second_token_does_not_re_arm(client, session, fake_room):
    _consent_to_recording(client, session["id"])
    client.post(f"/interview/sessions/{session['id']}/token")
    client.post(f"/interview/sessions/{session['id']}/token")

    assert len(fake_room["sessions"]) == 1


def test_a_video_service_failure_still_returns_a_token(client, session, monkeypatch, fake_room):
    """A candidate locked out of their interview is worse than an unrecorded one."""
    from apps.core.clients.vas_client import VasUnavailable
    from apps.core.services import room_service

    async def explode(*args, **kwargs):
        raise VasUnavailable("Video service unavailable")

    monkeypatch.setattr(room_service, "ensure_artifact_session", explode)
    _consent_to_recording(client, session["id"])

    response = client.post(f"/interview/sessions/{session['id']}/token")

    assert response.status_code == 200
    assert response.json()["token"]
    assert response.json()["recording_state"] == "failed"
    assert (
        InterviewSession.objects.get(id=session["id"]).recording_state
        == InterviewSession.RecordingState.FAILED
    )
