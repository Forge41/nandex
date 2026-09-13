"""Session creation, the GET the frontend replaces its fixture with, and stage progress."""

import pytest

from apps.interview.models import InterviewRound, InterviewSession
from apps.interview.rounds import DEFAULT_ROUNDS, STAGE_IDS, TOTAL_DURATION_MIN

pytestmark = pytest.mark.django_db


def test_creating_a_session_plans_the_default_rounds(client, session):
    assert [r["id"] for r in session["rounds"]] == list(STAGE_IDS)
    assert session["totalDurationMin"] == TOTAL_DURATION_MIN
    assert session["activeStage"] == "preflight"
    assert session["progressIndex"] == 0
    assert session["resume"] is None
    assert InterviewRound.objects.filter(session_id=session["id"]).count() == len(DEFAULT_ROUNDS)


def test_a_session_owns_a_room_name_derived_from_its_id(session):
    assert InterviewSession.objects.get(id=session["id"]).room_name == f"interview-{session['id']}"


def test_role_title_is_required(client):
    response = client.post("/interview/sessions", data={}, content_type="application/json")
    assert response.status_code == 400


def test_the_get_returns_the_shape_the_frontend_types_declare(client, session):
    body = client.get(f"/interview/sessions/{session['id']}").json()

    assert set(body) >= {
        "id",
        "candidateName",
        "roleTitle",
        "totalDurationMin",
        "rounds",
        "resume",
        "activeStage",
        "progressIndex",
        "consent",
        "startedAt",
        "content",
        "transcript",
    }
    assert set(body["consent"]) == {"recording", "aiInterviewer", "integrityMonitoring"}
    assert set(body["rounds"][0]) >= {"id", "label", "kind", "durationMin"}


def test_a_round_with_no_generated_content_is_absent_rather_than_null(client, session):
    """The UI already renders a missing-content state. An empty object keyed by stage
    would make it render a task with no fields instead."""
    assert session["content"] == {}


def test_another_visitor_cannot_read_the_session(other_client, session):
    assert other_client.get(f"/interview/sessions/{session['id']}").status_code == 404


def test_consent_is_patchable(client, session):
    body = client.patch(
        f"/interview/sessions/{session['id']}",
        data={"consent": {"recording": True, "aiInterviewer": True}},
        content_type="application/json",
    ).json()

    assert body["consent"] == {
        "recording": True,
        "aiInterviewer": True,
        "integrityMonitoring": False,
    }


def test_advancing_a_stage_moves_progress_forward(client, session):
    body = client.patch(
        f"/interview/sessions/{session['id']}",
        data={"activeStage": "behavioral"},
        content_type="application/json",
    ).json()

    assert body["activeStage"] == "behavioral"
    assert body["progressIndex"] == STAGE_IDS.index("behavioral")


def test_revisiting_an_earlier_round_does_not_re_lock_the_later_ones(client, session):
    """progress_index marks the furthest round unlocked, so it only ever moves forward --
    otherwise stepping back would lock everything the candidate already finished."""
    client.patch(
        f"/interview/sessions/{session['id']}",
        data={"activeStage": "sql"},
        content_type="application/json",
    )
    body = client.patch(
        f"/interview/sessions/{session['id']}",
        data={"activeStage": "behavioral"},
        content_type="application/json",
    ).json()

    assert body["activeStage"] == "behavioral"
    assert body["progressIndex"] == STAGE_IDS.index("sql")


def test_an_unknown_stage_is_rejected(client, session):
    response = client.patch(
        f"/interview/sessions/{session['id']}",
        data={"activeStage": "not-a-stage"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_starting_the_session_stamps_started_at_once(client, session):
    first = client.patch(
        f"/interview/sessions/{session['id']}",
        data={"start": True},
        content_type="application/json",
    ).json()
    assert first["startedAt"] is not None
    assert first["status"] == "active"

    second = client.patch(
        f"/interview/sessions/{session['id']}",
        data={"start": True},
        content_type="application/json",
    ).json()
    assert second["startedAt"] == first["startedAt"]


def test_ending_a_session_is_idempotent(client, session, fake_room):
    first = client.post(f"/interview/sessions/{session['id']}/end")
    second = client.post(f"/interview/sessions/{session['id']}/end")

    assert first.status_code == 200
    assert second.status_code == 200
    assert second.json()["status"] == "ended"


def test_ending_a_session_stops_an_armed_recording(client, session, fake_room):
    client.patch(
        f"/interview/sessions/{session['id']}",
        data={"consent": {"recording": True}},
        content_type="application/json",
    )
    client.post(f"/interview/sessions/{session['id']}/token")

    client.post(f"/interview/sessions/{session['id']}/end")

    assert fake_room["stops"] == [fake_room["vas_session_id"]]
    assert (
        InterviewSession.objects.get(id=session["id"]).recording_state
        == InterviewSession.RecordingState.STOPPED
    )


def test_recording_control_refuses_to_start_without_consent(client, session, fake_room):
    response = client.post(
        f"/interview/sessions/{session['id']}/recording",
        data={"action": "start"},
        content_type="application/json",
    )
    assert response.status_code == 400
    assert fake_room["starts"] == []


def test_recording_control_rejects_an_unknown_action(client, session, fake_room):
    response = client.post(
        f"/interview/sessions/{session['id']}/recording",
        data={"action": "pause"},
        content_type="application/json",
    )
    assert response.status_code == 400


def test_a_recording_conflict_from_vas_keeps_its_status(client, session, monkeypatch, fake_room):
    """A 409 means one is already running, which is a different thing for a caller than a
    fault -- flattening it to 502 would make those indistinguishable."""
    from apps.core.clients.vas_client import VasError
    from apps.core.services import room_service

    async def conflict(vas_session_id, **kwargs):
        raise VasError(409, "Recording EG_1 is already active")

    monkeypatch.setattr(room_service, "start_recording", conflict)
    client.patch(
        f"/interview/sessions/{session['id']}",
        data={"consent": {"recording": True}},
        content_type="application/json",
    )

    response = client.post(
        f"/interview/sessions/{session['id']}/recording",
        data={"action": "start"},
        content_type="application/json",
    )
    assert response.status_code == 409


def test_only_rounds_that_are_real_end_to_end_are_offered(session):
    """A round ships once its content is generated or imported and what the screen says
    happened is what happened. The rest are built screens whose runtime fields -- test
    outcomes, terminal output, result rows -- would be exactly the fabrications the coding
    and SQL rounds were rebuilt to remove."""
    from apps.interview.rounds import ALL_ROUNDS

    offered = {r["id"] for r in session["rounds"]}

    assert offered == {"preflight", "resume", "behavioral", "coding", "sql", "wrap"}
    assert {r["stage_id"] for r in ALL_ROUNDS} - offered == {"debug", "design", "quiz", "qa"}


def test_a_round_that_is_not_shipped_cannot_be_navigated_to(client, session):
    """Not merely hidden from the agenda: a stage nobody ships is not a stage."""
    response = client.patch(
        f"/interview/sessions/{session['id']}",
        data={"activeStage": "design"},
        content_type="application/json",
    )

    assert response.status_code == 400


def test_the_interview_still_has_an_ending(session):
    """Ending a session moves the candidate to the last round, so hiding the closing
    screen would drop them back onto the round they just finished."""
    assert session["rounds"][-1]["id"] == "wrap"
