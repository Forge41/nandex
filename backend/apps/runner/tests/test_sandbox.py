"""The sandbox, against a real Docker daemon.

The only tests in this repo that need one, so they skip without it. They are worth the
awkwardness: this is the one component whose failure modes are all in the interaction with
the kernel, and a mocked Docker would assert nothing about any of them.

Two halves. The first is containment -- what candidate code must not be able to reach.
The second is classification, which matters because the four answers here are paid for
differently: a compile failure costs the candidate no attempt, a crash does, and a test
that never ran must never acquire an outcome.
"""

import pytest

from apps.runner.languages import LANGUAGES
from apps.runner.sandbox import RunSpec, run

pytestmark = pytest.mark.docker


def execute(files, *, language="python", compile_ms=5_000, run_ms=10_000):
    events = list(
        run(RunSpec(LANGUAGES[language], files, compile_ms=compile_ms, run_ms=run_ms))
    )
    done = next(e["data"] for e in events if e["event"] == "done")
    terminal = "\n".join(
        e["data"]["text"] for e in events if e["event"] == "line"
    )
    streamed = [e["data"] for e in events if e["event"] == "test"]
    return done, terminal, streamed


def suite(body):
    return {"test_solution.py": body}


# ------------------------------------------------------------------ containment


def test_candidate_code_cannot_reach_the_database():
    """Postgres is on this host. --network none is what stops a run reading it."""
    done, terminal, _ = execute(
        suite(
            "import socket\n"
            "def test_reaches_postgres():\n"
            "    socket.create_connection(('host.docker.internal', 5432), timeout=3)\n"
        )
    )

    assert done["phase"] == "ran"
    assert [t["outcome"] for t in done["tests"]] == ["fail"]
    assert "Errno" in terminal or "error" in terminal.lower()


def test_candidate_code_cannot_reach_the_internet():
    done, _, _ = execute(
        suite(
            "import socket\n"
            "def test_reaches_out():\n"
            "    socket.create_connection(('1.1.1.1', 443), timeout=3)\n"
        )
    )

    assert [t["outcome"] for t in done["tests"]] == ["fail"]


def test_the_root_filesystem_is_read_only():
    done, _, _ = execute(
        suite("def test_writes():\n    open('/etc/passwd', 'w').write('x')\n")
    )

    assert [t["outcome"] for t in done["tests"]] == ["fail"]


def test_a_memory_bomb_is_killed_by_the_cgroup_not_by_the_host():
    done, _, _ = execute(
        suite(
            "def test_eats():\n"
            "    held = []\n"
            "    for _ in range(400):\n"
            "        held.append(' ' * 10_000_000)\n"
        )
    )

    assert done["phase"] == "crashed"


def test_unbounded_output_is_truncated_rather_than_streamed_forever():
    done, _, _ = execute(
        suite("def test_shouts():\n    [print('x' * 200) for _ in range(500_000)]\n")
    )

    assert done["truncated"] is True


def test_a_busy_loop_is_stopped_at_the_budget():
    done, _, _ = execute(
        suite("def test_spins():\n    while True:\n        pass\n"), run_ms=3_000
    )

    assert done["phase"] == "timeout"
    assert done["tests"] == []


# --------------------------------------------------------------- classification


def test_a_passing_and_a_failing_case_are_reported_separately():
    done, terminal, streamed = execute(
        {
            "solution.py": "def add(a, b):\n    return a + b\n",
            "test_solution.py": (
                "from solution import add\n"
                "def test_adds():\n    assert add(1, 2) == 3\n"
                "def test_wrong():\n    assert add(2, 2) == 5\n"
            ),
        }
    )

    assert done["phase"] == "ran"
    assert {t["name"]: t["outcome"] for t in done["tests"]} == {
        "test_adds": "pass",
        "test_wrong": "fail",
    }
    # The real assertion, not a summary line we parsed out of the output.
    assert "assert 4 == 5" in terminal


def test_each_case_is_reported_while_the_run_is_still_going():
    """The panel flips a case as it finishes. Arriving only in the final result would
    make that a lie, so the events are streamed as well as reconciled."""
    _, _, streamed = execute(
        suite("def test_one(): pass\ndef test_two(): pass\n")
    )

    assert [t["name"] for t in streamed] == ["test_one", "test_two"]


def test_code_that_does_not_parse_ran_no_tests_at_all():
    """Not "every test failed" -- nothing ran, and the candidate keeps their attempt."""
    done, _, _ = execute(suite("def test_broken(:\n    pass\n"))

    assert done["phase"] == "compile_failed"
    assert done["tests"] == []


def test_a_crash_keeps_the_cases_that_already_reported():
    """A process that dies mid-suite has still told us about the cases before it. Those
    stay; the ones after it stay absent rather than becoming failures."""
    done, _, _ = execute(
        {
            "test_solution.py": (
                "import os\n"
                "def test_first(): pass\n"
                "def test_kills_everything(): os.kill(os.getpid(), 9)\n"
                "def test_never_runs(): pass\n"
            )
        }
    )

    assert done["phase"] == "crashed"
    reported = {t["name"] for t in done["tests"]}
    assert "test_first" in reported
    assert "test_never_runs" not in reported


def test_the_container_is_gone_afterwards():
    import docker

    before = len(docker.from_env().containers.list(all=True))
    execute(suite("def test_quick(): pass\n"))

    assert len(docker.from_env().containers.list(all=True)) == before
