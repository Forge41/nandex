"""The bank of coding tasks, and what it promises about what it hands out.

The bank exists so that setting a task costs nothing and cannot fail mid-interview. These
pin the properties that make that true, and the one that makes it fair: two candidates in
the same seat must not get the same interview by accident.
"""

import json

import pytest

from apps.interview import task_bank


@pytest.fixture
def bank(tmp_path, monkeypatch):
    """A bank on disk, because loading from disk is what the real one does."""

    def write(slug: str, languages: list[str]):
        (tmp_path / f"{slug}.json").write_text(
            json.dumps(
                {
                    "slug": slug,
                    "title": slug,
                    "source": "exercism",
                    "licence": task_bank.__doc__ and "Exercism (https://exercism.org), MIT",
                    "brief": ["Do the thing."],
                    "attemptsAllowed": 3,
                    "tests": [{"name": "basic", "hidden": False}],
                    "languages": {
                        language: {
                            "files": [{"name": "solution.py", "content": "", "language": language}],
                            "tests": [{"name": "basic", "hidden": False}],
                        }
                        for language in languages
                    },
                }
            )
        )

    monkeypatch.setattr(task_bank, "BANK_DIR", tmp_path)
    return write


def test_the_shipped_bank_is_not_empty_and_every_task_can_be_set(monkeypatch):
    """Not a fixture: the tasks actually in the repository, which is what interviews get."""
    tasks = task_bank.load()

    assert len(tasks) >= 10
    for task in tasks:
        assert task["languages"], f"{task['slug']} has no language"
        assert task["brief"], f"{task['slug']} has no brief"
        # Attribution travels with the content, because the obligation does.
        assert task["licence"], f"{task['slug']} has no licence"
        for language, variant in task["languages"].items():
            assert variant["tests"], f"{task['slug']}/{language} lists no cases"
            editable = [f for f in variant["files"] if not f.get("readOnly")]
            assert len(editable) == 1, f"{task['slug']}/{language} has {len(editable)} editable"


def test_two_sessions_do_not_get_the_same_interview(bank):
    for slug in "abcdefghij":
        bank(slug, ["python"])

    first = [t["slug"] for t in task_bank.pick(2, seed="session-one", language="python")]
    second = [t["slug"] for t in task_bank.pick(2, seed="session-two", language="python")]

    assert first != second


def test_the_same_session_gets_the_same_interview_twice(bank):
    """Generation retries. A retry that set a different task would mean the candidate's
    round changed under them between one attempt at preparing it and the next."""
    for slug in "abcdefghij":
        bank(slug, ["python"])

    first = [t["slug"] for t in task_bank.pick(2, seed="same", language="python")]
    second = [t["slug"] for t in task_bank.pick(2, seed="same", language="python")]

    assert first == second


def test_a_candidates_own_language_is_preferred(bank):
    bank("only-python-one", ["python"])
    bank("only-python-two", ["python"])
    bank("has-java", ["python", "java"])

    picked = task_bank.pick(1, seed="whatever", language="java")

    assert picked[0]["slug"] == "has-java"


def test_a_task_without_the_language_is_still_offered_rather_than_nothing(bank):
    """A round the candidate can sit in Python beats no round at all."""
    bank("python-only", ["python"])

    picked = task_bank.pick(1, seed="whatever", language="java")

    assert picked[0]["slug"] == "python-only"


def test_an_empty_bank_hands_back_nothing_rather_than_failing(bank):
    assert task_bank.pick(2, seed="whatever", language="python") == []
