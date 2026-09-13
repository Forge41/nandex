"""Generating the SQL round: a schema, a question, and the answer it is checked against.

The expected result is not written by the model. The model writes a *correct query*, that
query is run in the sandbox against the generated schema, and **what it returns** becomes
the expectation. A model asked for the rows directly would produce plausible ones, and a
candidate's correct answer would then be marked wrong against them.

The expected result is stored as a `hidden` file: the sandbox gets it, the browser never
does. Sending it to the browser would be handing over the answer and trusting nobody to
look.
"""

from __future__ import annotations

import json
import logging

from ai.client import complete
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.core.clients import runner_client
from apps.interview.coding_generation import TaskUnusable, _decode
from apps.interview.config import settings

logger = logging.getLogger(__name__)

PROMPT = "interview_round_sql_system.md"


async def generate(brief: dict) -> dict:
    raw = await complete(
        system_prompt=load_prompt(PROMPT),
        messages=[{"role": "user", "content": json.dumps(brief)}],
        model=settings.plan_model,
    )
    written = _decode(raw)
    task = _sanitize(written)

    expected = await _expected_result(task, written["solution"])
    task["languages"] = {
        "sql": {
            "files": [
                {"name": "query.sql", "language": "sql", "content": task.pop("_starter")},
                {
                    "name": "schema.sql",
                    "language": "sql",
                    "content": written["schemaSql"],
                    "hidden": True,
                },
                {
                    "name": "seed.sql",
                    "language": "sql",
                    "content": written.get("seedSql") or "",
                    "hidden": True,
                },
                {
                    "name": "expected.csv",
                    "language": "sql",
                    "content": expected,
                    "hidden": True,
                },
            ]
        }
    }
    return task


async def _expected_result(task: dict, solution: str) -> str:
    """Runs the model's own solution and keeps what it returned.

    A generated expectation would be a guess about a query nobody executed -- the same
    fabrication as a generated test outcome, one layer further back.
    """
    files = {
        "schema.sql": task["_schema_sql"],
        "seed.sql": task["_seed_sql"],
        "query.sql": solution,
    }
    rows = None
    done = None
    for event in await sync_to_async(_run_sync, thread_sensitive=False)(files):
        if event["event"] == "rows":
            rows = event["data"].get("csv")
        elif event["event"] == "done":
            done = event["data"]

    if done is None or done.get("phase") != "ran" or not rows:
        raise TaskUnusable(
            f"the reference query did not run ({(done or {}).get('phase', 'no result')})"
        )
    if not [t for t in done.get("tests", []) if t.get("outcome") == "pass"]:
        raise TaskUnusable("the reference query failed against its own schema")
    return rows


def _run_sync(files: dict[str, str]) -> list[dict]:
    return list(runner_client.run(language="sql", files=files))


def _sanitize(written: dict) -> dict:
    prompt = str(written.get("prompt") or "").strip()
    schema_sql = str(written.get("schemaSql") or "").strip()
    solution = str(written.get("solution") or "").strip()
    if not prompt or not schema_sql or not solution:
        raise TaskUnusable("the SQL task was missing its prompt, schema or solution")

    return {
        "title": str(written.get("title") or "SQL").strip(),
        "prompt": prompt,
        "schema": _sanitize_schema(written.get("schema")),
        "attemptsAllowed": max(1, min(5, int(written.get("attemptsAllowed") or 3))),
        # The cases the panel lists. Fixed here rather than asked of the model: a SQL
        # answer either runs or it does not, and either matches or it does not.
        "tests": [
            {"name": "query runs", "hidden": False},
            {"name": "result matches", "hidden": False},
        ],
        **({"citation": written["citation"]} if isinstance(written.get("citation"), int) else {}),
        "_starter": str(written.get("starter") or "SELECT\n"),
        "_schema_sql": schema_sql,
        "_seed_sql": str(written.get("seedSql") or ""),
    }


def _sanitize_schema(written) -> list[dict]:
    tables = []
    for table in written or []:
        if not isinstance(table, dict) or not table.get("name"):
            continue
        columns = [
            {"name": str(c.get("name")), "type": str(c.get("type") or "")}
            for c in table.get("columns") or []
            if isinstance(c, dict) and c.get("name")
        ]
        if columns:
            tables.append({"name": str(table["name"]), "columns": columns})
    if not tables:
        raise TaskUnusable("the SQL task described no tables")
    return tables
