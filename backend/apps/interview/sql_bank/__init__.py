"""The SQL tasks this system can set, as data rather than as a model call.

Every task here was **proved runnable before it was written**: its reference query was
executed against its own schema and seed in the real Postgres sandbox, and the rows that
came back are the `expected.csv` a candidate is graded against. Nothing in this directory
is a prediction about what a query would return.

These files are where the bank is authored; `manage.py load_task_banks` is what makes it
readable at interview time. `load()` reads the files, `pick()` reads the rows.

Written for this repository rather than imported. The obvious sources of ready-made SQL
exercises are licensed in ways an MIT project cannot take -- pgexercises is
CC BY-NC-SA, and the large practice sites reserve all rights -- and basic SQL exercises
are short enough that writing them is cheaper than clearing a licence. The shapes are the
ordinary ones any SQL course teaches: filter, order, group, join, and the anti-join.
"""

import json
import random
from pathlib import Path

BANK_DIR = Path(__file__).resolve().parent


def load() -> list[dict]:
    tasks = []
    for path in sorted(BANK_DIR.glob("*.json")):
        try:
            tasks.append(json.loads(path.read_text()))
        except json.JSONDecodeError:
            continue
    return tasks


def pick(*, seed: str) -> dict | None:
    """One live task, chosen by the session.

    Seeded so a retried preparation sets the same task rather than a different one, and
    so two candidates in the same seat are not handed the same task by accident of row
    order. Chosen in Python rather than by `ORDER BY random()`, which is not
    reproducible from a seed.
    """
    from apps.interview.models import InterviewTask

    payloads = list(
        InterviewTask.objects.filter(kind=InterviewTask.Kind.SQL, retired_at__isnull=True)
        .order_by("slug")
        .values_list("payload", flat=True)
    )
    if not payloads:
        return None
    return random.Random(seed).choice(payloads)
