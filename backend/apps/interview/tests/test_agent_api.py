"""The interviewer agent's two endpoints.

They are the only way into an interview that does not go through a candidate's cookie, so
what they let through, and to whom, is the whole of what these pin.
"""

import json

import pytest

from apps.interview.models import ResumeFacts, TranscriptTurn

pytestmark = pytest.mark.django_db

TOKEN = "test-agent-token"


@pytest.fixture(autouse=True)
def agent_token(monkeypatch):
    monkeypatch.setattr("apps.interview.config.settings.agent_bearer_token", TOKEN)


def auth(token: str = TOKEN) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {token}"}


@pytest.fixture
def planned(client, session):
    """A session with a plan on it, as the agent would find one."""
    facts = ResumeFacts.objects.create(
        session_id=session["id"],
        file_name="resume.pdf",
        candidate_name="Priya Raghunathan",
        candidate_title="Senior Backend Engineer",
        candidate_years_experience=7,
        probes=[{"title": "Latency", "note": "How it was measured", "citation": 3}],
        citations=[{"id": 3, "quote": "cutting settlement latency by 40 percent"}],
    )
    session_id = session["id"]
    from apps.interview.models import InterviewRound

    InterviewRound.objects.filter(session_id=session_id, stage_id="behavioral").update(
        summary="Ownership scope", citation=3
    )
    return session_id, facts


def test_the_brief_carries_the_plan_and_the_lines_it_came_from(client, planned):
    session_id, _ = planned

    body = client.get(f"/interview/agent/sessions/{session_id}/brief", **auth()).json()

    assert body["candidateName"] == "Priya Raghunathan"
    behavioral = next(r for r in body["rounds"] if r["id"] == "behavioral")
    assert behavioral["summary"] == "Ownership scope"
    assert behavioral["citation"] == 3
    assert body["resume"]["citations"][0]["quote"] == "cutting settlement latency by 40 percent"


def test_the_brief_leaves_out_the_rounds_there_is_nothing_to_say_about(client, planned):
    """pre-flight and the plan screen are what the candidate is looking at while the
    interviewer talks; describing them back is noise."""
    session_id, _ = planned

    body = client.get(f"/interview/agent/sessions/{session_id}/brief", **auth()).json()

    assert {r["id"] for r in body["rounds"]}.isdisjoint({"preflight", "resume"})


def test_the_brief_withholds_consent_and_recording_state(client, planned):
    """The agent decides what to say, not what may be recorded. Those are core's, and a
    brief that carried them would invite the agent to act on them."""
    session_id, _ = planned

    body = client.get(f"/interview/agent/sessions/{session_id}/brief", **auth()).json()

    assert "consent" not in body
    assert "recordingState" not in body
    assert "roomName" not in body


def test_a_session_with_no_plan_yet_says_so_rather_than_failing(client, session):
    body = client.get(f"/interview/agent/sessions/{session['id']}/brief", **auth()).json()

    assert body["planReady"] is False
    assert body["resume"] is None


def test_the_wrong_token_is_refused(client, session):
    assert client.get(
        f"/interview/agent/sessions/{session['id']}/brief", **auth("not-the-token")
    ).status_code == 401


def test_no_token_is_refused(client, session):
    assert client.get(f"/interview/agent/sessions/{session['id']}/brief").status_code == 401


def test_an_unset_token_refuses_everything_rather_than_accepting_anything(
    client, session, monkeypatch
):
    """A misconfigured deployment must be unreachable, not open."""
    monkeypatch.setattr("apps.interview.config.settings.agent_bearer_token", "")

    assert client.get(
        f"/interview/agent/sessions/{session['id']}/brief", **auth("")
    ).status_code == 401


def test_turns_are_appended_in_the_order_they_were_said(client, session):
    response = client.post(
        f"/interview/agent/sessions/{session['id']}/transcript",
        data=json.dumps(
            {
                "turns": [
                    {"speaker": "interviewer", "text": "Hello Priya.", "atSeconds": 2},
                    {"speaker": "candidate", "text": "Hi.", "atSeconds": 5},
                ]
            }
        ),
        content_type="application/json",
        **auth(),
    )

    assert response.status_code == 201
    assert response.json() == {"written": 2}
    stored = list(TranscriptTurn.objects.filter(session_id=session["id"]))
    assert [(t.speaker, t.text, t.at_seconds) for t in stored] == [
        ("interviewer", "Hello Priya.", 2),
        ("candidate", "Hi.", 5),
    ]


def test_one_malformed_turn_does_not_lose_the_conversation(client, session):
    """A transcript is the record a human reviews; dropping the whole of it over one bad
    entry is the worse failure."""
    response = client.post(
        f"/interview/agent/sessions/{session['id']}/transcript",
        data=json.dumps(
            {
                "turns": [
                    {"speaker": "narrator", "text": "not a speaker here"},
                    {"speaker": "candidate", "text": "   "},
                    {"speaker": "candidate", "text": "This one counts."},
                ]
            }
        ),
        content_type="application/json",
        **auth(),
    )

    assert response.json() == {"written": 1}


def test_the_browser_has_no_path_to_the_transcript(client, session):
    """Cookie-authenticated is not agent-authenticated: the candidate's own browser must
    not be able to write the record of what they said."""
    response = client.post(
        f"/interview/agent/sessions/{session['id']}/transcript",
        data=json.dumps({"turns": [{"speaker": "candidate", "text": "I said this"}]}),
        content_type="application/json",
    )

    assert response.status_code == 401
    assert not TranscriptTurn.objects.exists()


def test_an_unknown_session_is_not_found(client):
    assert client.get(f"/interview/agent/sessions/{'d' * 24}/brief", **auth()).status_code == 404
