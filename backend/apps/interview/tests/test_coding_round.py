"""The coding round's server side.

What these pin is mostly one question: can a candidate change the answer to how well they
did? They can save drafts, take attempts and read results, and every one of those is a
path to their own grade.
"""

import json

import pytest

from apps.interview import coding
from apps.interview.models import CodeDraft, CodeRun, InterviewRound

pytestmark = pytest.mark.django_db

TASK = {
    "index": 1,
    "total": 1,
    "title": "Retry-safe applier",
    "attemptsAllowed": 3,
    "tests": [{"name": "single_transfer", "hidden": False}],
    "languages": {
        "python": {
            "files": [
                {"name": "solution.py", "language": "python", "content": "def apply(e): ..."},
                {
                    "name": "test_solution.py",
                    "language": "python",
                    "content": "def test_single_transfer(): assert apply({}) is True",
                    "readOnly": True,
                },
            ]
        }
    },
}


@pytest.fixture
def coded(client, session):
    InterviewRound.objects.filter(session_id=session["id"], stage_id="coding").update(
        content={"tasks": [TASK], "defaultLanguage": "python"},
        content_state=InterviewRound.ContentState.READY,
    )
    return session["id"]


def draft(client, session_id, name, content="x = 1", language="python"):
    return client.put(
        f"/interview/sessions/{session_id}/rounds/coding/draft",
        data=json.dumps(
            {"name": name, "content": content, "language": language, "taskIndex": 0}
        ),
        content_type="application/json",
    )


def test_a_draft_for_the_candidates_own_file_is_saved(client, coded):
    assert draft(client, coded, "solution.py").status_code == 200

    stored = CodeDraft.objects.get(session_id=coded, file_name="solution.py")
    assert stored.content == "x = 1"
    # Candidate data, on the same clock as their recording.
    assert stored.retain_until is not None


def test_a_draft_named_after_the_test_file_is_refused(client, coded):
    """The whole grade is downstream of this. `readOnly` is an editor property; without a
    server rule a candidate saves their own assertions and the sandbox runs them."""
    response = draft(client, coded, "test_solution.py", content="def test_single_transfer(): pass")

    assert response.status_code == 400
    assert not CodeDraft.objects.filter(file_name="test_solution.py").exists()


def test_a_draft_for_a_file_the_task_never_had_is_refused(client, coded):
    """conftest.py, a second test module, a traversing path -- all the same refusal."""
    for name in ("conftest.py", "../escape.py", "extra_test.py"):
        assert draft(client, coded, name).status_code == 400
    assert CodeDraft.objects.count() == 0


def test_the_test_file_sent_to_the_sandbox_comes_from_the_task(client, coded):
    """Even with a draft row forced in behind the endpoint's back, the payload is rebuilt
    from the stored task -- so the file that decides the verdict is never the candidate's."""
    CodeDraft.objects.create(
        session_id=coded,
        stage_id="coding",
        task_index=0,
        language="python",
        file_name="test_solution.py",
        content="def test_single_transfer(): assert True",
    )
    draft(client, coded, "solution.py", content="def apply(e): return True")

    payload = coding.runner_payload(
        session_id=coded, stage_id="coding", task_index=0, language="python"
    )

    assert payload["solution.py"] == "def apply(e): return True"
    assert payload["test_solution.py"] == TASK["languages"]["python"]["files"][1]["content"]


def test_another_candidate_cannot_save_a_draft(client, other_client, coded):
    response = other_client.put(
        f"/interview/sessions/{coded}/rounds/coding/draft",
        data=json.dumps({"name": "solution.py", "content": "x", "language": "python"}),
        content_type="application/json",
    )

    assert response.status_code == 404
    assert not CodeDraft.objects.exists()


def _run(session_id, phase, tests, attempt):
    return CodeRun.objects.create(
        session_id=session_id,
        stage_id="coding",
        task_index=0,
        language="python",
        attempt=attempt,
        phase=phase,
        tests=tests,
    )


def test_a_compile_failure_costs_no_attempt(coded):
    """Otherwise three attempts means three real tries in Python and possibly one in C++,
    where a missing semicolon is a scored attempt."""
    _run(coded, CodeRun.Phase.COMPILE_FAILED, [], 1)

    assert coding.attempts_used(coded, "coding", 0) == 0


def test_a_runner_that_was_unreachable_costs_no_attempt(coded):
    _run(coded, CodeRun.Phase.UNAVAILABLE, [], 1)

    assert coding.attempts_used(coded, "coding", 0) == 0


def test_a_crash_and_a_timeout_do_cost_an_attempt(coded):
    _run(coded, CodeRun.Phase.CRASHED, [], 1)
    _run(coded, CodeRun.Phase.TIMEOUT, [], 2)

    assert coding.attempts_used(coded, "coding", 0) == 2


def test_the_attempt_is_claimed_before_the_run_not_after(coded):
    """The row exists while the run is still going, so a second request racing it sees
    the attempt as taken rather than as available."""
    run = coding.claim_attempt(
        session_id=coded, stage_id="coding", task_index=0, language="python", files={}
    )

    assert run.phase == CodeRun.Phase.RUNNING
    assert coding.attempts_used(coded, "coding", 0) == 1


def test_the_attempt_limit_refuses_once_it_is_spent(coded):
    for _ in range(3):
        coding.claim_attempt(
            session_id=coded, stage_id="coding", task_index=0, language="python", files={}
        )

    with pytest.raises(coding.AttemptsExhausted):
        coding.claim_attempt(
            session_id=coded, stage_id="coding", task_index=0, language="python", files={}
        )


def test_taking_an_attempt_past_the_limit_is_a_409(client, coded):
    for _ in range(3):
        coding.claim_attempt(
            session_id=coded, stage_id="coding", task_index=0, language="python", files={}
        )

    response = client.post(
        f"/interview/sessions/{coded}/rounds/coding/runs",
        data=json.dumps({"language": "python", "taskIndex": 0}),
        content_type="application/json",
    )

    assert response.status_code == 409
    assert CodeRun.objects.count() == 3


def test_partial_is_the_outcome_when_some_tests_passed(coded):
    run = _run(
        coded,
        CodeRun.Phase.RAN,
        [{"name": "a", "outcome": "pass"}, {"name": "b", "outcome": "fail"}],
        1,
    )

    assert run.outcome == "partial"


def test_pass_needs_every_reported_case(coded):
    run = _run(coded, CodeRun.Phase.RAN, [{"name": "a", "outcome": "pass"}], 1)

    assert run.outcome == "pass"


def test_a_case_that_never_ran_does_not_count_as_passing(coded):
    """A crash leaves later cases with no outcome. They are absent, not passed -- the
    difference is the whole point of the phase."""
    run = _run(
        coded,
        CodeRun.Phase.CRASHED,
        [{"name": "a", "outcome": "pass"}, {"name": "b"}],
        1,
    )

    assert run.outcome == "pass"
    assert [t.get("outcome") for t in run.tests] == ["pass", None]


def test_the_last_run_summary_is_derived_not_stored(coded):
    _run(
        coded,
        CodeRun.Phase.RAN,
        [
            {"name": "a", "outcome": "pass"},
            {"name": "b", "outcome": "pass"},
            {"name": "c", "outcome": "fail"},
        ],
        1,
    )

    state = coding.attempt_state(coded, "coding", 0)

    assert state["lastRunSummary"] == "Last run: 2 of 3 tests passed"
    assert state["attemptOutcomes"] == ["partial"]


def test_a_compile_failure_says_so_rather_than_reporting_a_score(coded):
    _run(coded, CodeRun.Phase.COMPILE_FAILED, [], 1)

    state = coding.attempt_state(coded, "coding", 0)

    assert state["lastRunSummary"] == "Last run: didn't compile, so no attempt was used"
    assert state["attemptOutcomes"] == []
    assert state["attemptsUsed"] == 0
