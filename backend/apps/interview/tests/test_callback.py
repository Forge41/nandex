"""The vas callback is the only routable machine-to-machine endpoint, and it is retried.

Three properties matter: the signature is verified against raw bytes, a retry leaves one
row, and nothing it does mints an identity.
"""

import json
import time

import pytest
from django.contrib.sessions.models import Session
from django.test import Client

from apps.core.models import Project, User, Workspace
from apps.core.services import room_service
from apps.interview.models import InterviewSession, SessionRecording
from apps.vas_recordings.activities import sign_callback

pytestmark = pytest.mark.django_db

SECRET = "shared-callback-secret-at-least-32-bytes"
CALLBACK_URL = "/interview/callbacks/vas"


@pytest.fixture(autouse=True)
def _shared_secret(monkeypatch):
    monkeypatch.setattr(room_service.settings, "vas_callback_signing_secret", SECRET)


def _post(payload: dict, *, signed_body: bytes | None = None, at: int | None = None):
    raw = json.dumps(payload).encode()
    timestamp = str(at if at is not None else int(time.time()))
    signature = sign_callback(signed_body if signed_body is not None else raw, timestamp, SECRET)
    return Client().post(
        CALLBACK_URL,
        data=raw,
        content_type="application/json",
        headers={"x-vas-signature": f"sha256={signature}", "x-vas-timestamp": timestamp},
    )


def _complete_payload(session_id: str, **overrides) -> dict:
    recording = {
        "id": "b" * 24,
        "egress_id": "EG_1",
        "status": "complete",
        "gcs_bucket": "local-recordings",
        "gcs_object_key": f"recordings/{session_id}/1.mp4",
        "duration_seconds": 23.5,
        "file_size_bytes": 8989427,
        "checksum": "",
        "failure_reason": "",
    }
    recording.update(overrides)
    return {
        "event": "recording.complete",
        "external_session_id": session_id,
        "recording": recording,
    }


def test_a_signed_completion_is_recorded(client, session):
    response = _post(_complete_payload(session["id"]))

    assert response.status_code == 200
    recording = SessionRecording.objects.get(session_id=session["id"])
    assert recording.egress_id == "EG_1"
    assert recording.duration_seconds == 23.5
    assert recording.file_size_bytes == 8989427
    # The object key, never a signed URL: those expire in hours.
    assert recording.gcs_object_key.endswith("1.mp4")


def test_the_same_callback_three_times_leaves_one_row(client, session):
    payload = _complete_payload(session["id"])
    for _ in range(3):
        assert _post(payload).status_code == 200

    assert SessionRecording.objects.filter(session_id=session["id"]).count() == 1


def test_a_reserialized_body_is_rejected(client, session):
    """The signature covers the exact bytes vas emitted; json.dumps of the parsed dict
    differs in separator whitespace, so verifying anything but request.body would verify
    something vas never signed."""
    payload = _complete_payload(session["id"])
    # Compact separators, not json.dumps' defaults -- those are already (", ", ": "), so a
    # "reserialized" body built with them is byte-identical and proves nothing.
    reserialized = json.dumps(payload, separators=(",", ":")).encode()
    assert reserialized != json.dumps(payload).encode()
    assert json.loads(reserialized) == payload

    response = _post(payload, signed_body=reserialized)

    assert response.status_code == 401
    assert not SessionRecording.objects.exists()


def test_a_stale_callback_is_rejected(client, session):
    stale = int(time.time()) - room_service.CALLBACK_MAX_SKEW_SECONDS - 60
    assert _post(_complete_payload(session["id"]), at=stale).status_code == 401


def test_an_unsigned_callback_is_rejected(client, session):
    response = Client().post(
        CALLBACK_URL,
        data=json.dumps(_complete_payload(session["id"])),
        content_type="application/json",
    )
    assert response.status_code == 401


def test_an_unknown_session_is_answered_200_not_4xx(client):
    """A 4xx would make vas retry forever over something we will never process."""
    response = _post(_complete_payload("c" * 24))

    assert response.status_code == 200
    assert not SessionRecording.objects.exists()


def test_an_unhandled_event_is_answered_200(client, session):
    response = _post({"event": "something.new", "external_session_id": session["id"]})
    assert response.status_code == 200


def test_a_failed_recording_lands_the_session_in_failed(client, session):
    _post(_complete_payload(session["id"], status="failed", failure_reason="ffmpeg crash"))

    assert (
        InterviewSession.objects.get(id=session["id"]).recording_state
        == InterviewSession.RecordingState.FAILED
    )


def test_the_callback_mints_no_identity_however_many_times_it_is_retried(client, session):
    """Cookie-less and retried. Without the exempt-prefix guard in settings this would
    create a User, Workspace, WorkspaceMember and Project per delivery."""
    before = (
        User.objects.count(),
        Workspace.objects.count(),
        Project.objects.count(),
        Session.objects.count(),
    )

    payload = _complete_payload(session["id"])
    for _ in range(10):
        _post(payload)
    # An invalid one too: rejection happens after the middleware would have run.
    Client().post(CALLBACK_URL, data="{}", content_type="application/json")

    assert (
        User.objects.count(),
        Workspace.objects.count(),
        Project.objects.count(),
        Session.objects.count(),
    ) == before
