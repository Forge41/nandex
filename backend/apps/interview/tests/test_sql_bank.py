"""The SQL bank is the whole SQL round now, so what it hands over has to be complete.

A task missing a hidden file does not fail at pick time -- it fails in the sandbox,
during someone's interview, as a run that could not be set up.
"""

import csv
import io

import pytest
from django.core.management import call_command
from django.utils import timezone

from apps.interview import sql_bank, task_bank
from apps.interview.models import InterviewTask

REQUIRED_FILES = {"query.sql", "schema.sql", "seed.sql", "expected.csv"}


def test_the_bank_is_not_empty():
    assert sql_bank.load(), "run `manage.py build_sql_bank`"


@pytest.mark.parametrize("task", sql_bank.load(), ids=lambda t: t["slug"])
def test_every_task_carries_what_the_sandbox_needs(task):
    files = {f["name"]: f for f in task["languages"]["sql"]["files"]}

    assert set(files) >= REQUIRED_FILES
    # Everything but the starter is the answer or the fixture behind it. The serializer
    # strips hidden files, so a starter marked hidden would reach the candidate as an
    # empty editor and the rest would reach them as the answer.
    assert not files["query.sql"].get("hidden")
    assert all(files[name]["hidden"] for name in REQUIRED_FILES - {"query.sql"})


@pytest.mark.parametrize("task", sql_bank.load(), ids=lambda t: t["slug"])
def test_the_expected_result_is_rows_postgres_actually_returned(task):
    """Built by running the reference query, so it must look like a result set: a header
    and at least one row. An empty file would pass any query that returns nothing."""
    files = {f["name"]: f["content"] for f in task["languages"]["sql"]["files"]}
    rows = list(csv.reader(io.StringIO(files["expected.csv"])))

    assert len(rows) >= 2
    assert all(len(row) == len(rows[0]) for row in rows)


@pytest.mark.parametrize("task", sql_bank.load(), ids=lambda t: t["slug"])
def test_the_schema_shown_matches_the_schema_created(task):
    """The sidebar is read off the DDL when the bank is built. If they drift, a candidate
    is told about a column the database does not have."""
    created = {f["content"] for f in task["languages"]["sql"]["files"] if f["name"] == "schema.sql"}
    ddl = created.pop()

    for table in task["schema"]:
        assert f"CREATE TABLE {table['name']}" in ddl
        for column in table["columns"]:
            assert column["name"] in ddl


@pytest.mark.django_db
def test_the_same_session_is_always_set_the_same_task():
    """Picks from rows, so this loads them the way a deploy does."""
    call_command("load_task_banks")

    assert sql_bank.pick(seed="s1") == sql_bank.pick(seed="s1")


@pytest.mark.django_db
def test_a_retired_task_is_never_set_again():
    call_command("load_task_banks")
    InterviewTask.objects.filter(kind=InterviewTask.Kind.SQL).update(retired_at=timezone.now())

    assert sql_bank.pick(seed="s1") is None


@pytest.mark.django_db
def test_loading_twice_updates_rather_than_duplicates():
    """It runs on every deploy, so it has to be idempotent."""
    call_command("load_task_banks")
    before = InterviewTask.objects.count()
    call_command("load_task_banks")

    assert InterviewTask.objects.count() == before
    assert before == len(sql_bank.load()) + len(task_bank.load())
