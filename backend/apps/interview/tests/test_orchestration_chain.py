"""interview -> core.room_service -> core.vas_client, with only the outermost seam faked.

The other interview tests fake room_service itself, which is fast but hides drift between
the layers: a signature change in room_service passed every one of them and only failed
against a running service. These exercise the real chain and stop at HTTP.
"""

import pytest

from apps.core.clients import vas_client
from apps.interview.models import InterviewSession

pytestmark = pytest.mark.django_db


@pytest.fixture
def fake_vas_http(monkeypatch):
    """Replaces only the HTTP call, so room_service and its caller are the real code."""
    calls = []

    async def register_session(external_session_id, room_name, metadata=None, auto_record=False):
        calls.append(
            {
                "external_session_id": external_session_id,
                "room_name": room_name,
                "metadata": metadata,
                "auto_record": auto_record,
            }
        )
        return {"id": "e" * 24, "external_session_id": external_session_id}

    async def stop_recording(vas_session_id, recording_id=None):
        calls.append({"stopped": vas_session_id})
        return {"id": "rec-1", "status": "ending"}

    monkeypatch.setattr(vas_client, "register_session", register_session)
    monkeypatch.setattr(vas_client, "stop_recording", stop_recording)
    return calls


@pytest.fixture
def fake_tps_grpc(monkeypatch):
    from apps.core.clients import tps_client

    async def mint_room_token(**kwargs):
        return {"token": "jwt", "ws_url": "ws://livekit.test", "expires_in": 900}

    monkeypatch.setattr(tps_client, "mint_room_token", mint_room_token)


def test_arming_a_recording_reaches_vas_with_auto_record_set(
    client, session, fake_vas_http, fake_tps_grpc
):
    client.patch(
        f"/interview/sessions/{session['id']}",
        data={"consent": {"recording": True}},
        content_type="application/json",
    )

    response = client.post(f"/interview/sessions/{session['id']}/token")

    assert response.json()["recording_state"] == "armed"
    registered = fake_vas_http[0]
    assert registered["external_session_id"] == session["id"]
    assert registered["room_name"] == f"interview-{session['id']}"
    assert registered["auto_record"] is True
    assert registered["metadata"] == {"role_title": session["roleTitle"]}
    assert InterviewSession.objects.get(id=session["id"]).vas_session_id == "e" * 24


def test_the_chain_is_not_walked_at_all_without_consent(
    client, session, fake_vas_http, fake_tps_grpc
):
    client.post(f"/interview/sessions/{session['id']}/token")
    assert fake_vas_http == []


def test_ending_the_session_stops_recording_through_the_real_chain(
    client, session, fake_vas_http, fake_tps_grpc
):
    client.patch(
        f"/interview/sessions/{session['id']}",
        data={"consent": {"recording": True}},
        content_type="application/json",
    )
    client.post(f"/interview/sessions/{session['id']}/token")

    client.post(f"/interview/sessions/{session['id']}/end")

    assert {"stopped": "e" * 24} in fake_vas_http
