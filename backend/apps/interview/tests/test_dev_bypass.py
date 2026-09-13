"""The development shortcut to a round, and the thing that keeps it out of a deployment.

A bypass that creates a consented, plan-ready session is a way into an interview if it is
ever reachable in production, so what these mostly pin is that it is not routed there.
"""

import importlib
import json

import pytest
from django.test import override_settings

from apps.interview.models import InterviewRound, InterviewSession

# pytest-django runs with DEBUG off, which is right -- and means the real URLconf does not
# mount this route at all. These tests ask for it explicitly rather than turning DEBUG on,
# so what is exercised is the view, and the mounting rule is tested separately below.
pytestmark = pytest.mark.django_db


@pytest.fixture(autouse=True)
def dev_urlconf(settings):
    settings.ROOT_URLCONF = "apps.interview.tests.dev_urls"


def jump(client, stage="coding", language="python"):
    return client.post(
        "/interview/dev/sessions",
        data=json.dumps({"stage": stage, "language": language}),
        content_type="application/json",
    )


def test_the_route_does_not_exist_without_debug():
    """Not mounted rather than mounted-and-refusing: a route that exists is one
    misconfiguration away from being reachable, and a route that was never added to
    urlpatterns cannot be reached by any configuration.

    Reloading the module is the only way to re-run the conditional, so the real setting is
    put back afterwards -- a leaked reload would leave every later test resolving URLs
    against a list nobody else is holding.
    """
    from apps.interview.api import urls

    def dev_routes():
        return [p for p in urls.urlpatterns if "dev" in str(p.pattern)]

    try:
        with override_settings(DEBUG=False):
            importlib.reload(urls)
            assert dev_routes() == []

        with override_settings(DEBUG=True):
            importlib.reload(urls)
            assert dev_routes()
    finally:
        importlib.reload(urls)


def test_it_opens_the_round_asked_for(client):
    body = jump(client, "coding").json()

    assert body["activeStage"] == "coding"
    # Unlocked too, or the browser refuses the jump its own reducer is asked to make.
    assert body["progressIndex"] == [r["id"] for r in body["rounds"]].index("coding")
    assert body["content"]["coding"]["tasks"]


def test_the_coding_round_gets_real_tasks_rather_than_a_fixture(client):
    """The bank's tasks were proved runnable on import. A dev shortcut is a reason to skip
    the rounds before this one, not a reason to set a task nobody can run."""
    body = jump(client, "coding", "java").json()

    tasks = body["content"]["coding"]["tasks"]
    assert all(task["languages"] for task in tasks)
    assert all(task["licence"] for task in tasks)


def test_the_sql_round_gets_a_sql_task(client):
    """The bank holds no SQL exercises, so asking it for one would put a Python task in
    the SQL round."""
    body = jump(client, "sql").json()

    task = body["content"]["sql"]["tasks"][0]
    assert list(task["languages"]) == ["sql"]
    assert task["schema"]


def test_seeded_content_says_it_was_seeded(client):
    """Nothing here reaches a candidate, but content that reads as generated is how
    something fabricated ends up being believed later."""
    body = jump(client, "behavioral").json()

    assert "dev bypass" in " ".join(body["content"]["behavioral"]["derivedFrom"]).lower()


def test_an_unshipped_round_is_refused(client):
    response = jump(client, "design")

    assert response.status_code == 400
    assert InterviewSession.objects.count() == 0


def test_the_session_belongs_to_whoever_asked_for_it(client, other_client):
    """The whole reason this is an endpoint and not a management command: a session made
    on the command line belongs to no cookie and reads as 'not found' in the browser."""
    session_id = jump(client, "coding").json()["id"]

    assert client.get(f"/interview/sessions/{session_id}").status_code == 200
    assert other_client.get(f"/interview/sessions/{session_id}").status_code == 404


def test_consent_is_granted_so_the_round_behaves_as_it_would_for_a_candidate(client):
    body = jump(client, "coding").json()

    assert body["consent"] == {
        "recording": True,
        "aiInterviewer": True,
        "integrityMonitoring": True,
    }


def test_the_rounds_before_the_one_asked_for_are_prepared_too(client):
    """Stepping back from the round under test should not land on an empty screen."""
    session_id = jump(client, "sql").json()["id"]

    states = {
        r.stage_id: r.content_state for r in InterviewRound.objects.filter(session_id=session_id)
    }
    assert states["coding"] == InterviewRound.ContentState.READY
    assert states["behavioral"] == InterviewRound.ContentState.READY
