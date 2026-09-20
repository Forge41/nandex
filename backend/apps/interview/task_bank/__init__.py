"""The coding tasks this system can set, as data rather than as a model call.

Each file here is one task, imported and **proved runnable** before it was written: its
reference solution was executed against its own tests in the real sandbox. Nothing lands
here that a candidate could not pass.

Imported exercises carry their source and licence. Exercism's tracks are MIT; the licence
travels with the task rather than living in a note somewhere else, because the attribution
obligation belongs to the content.

Nothing generates a coding task any more. These files are where the bank is authored --
a diff is reviewable and the history is in git -- and `manage.py load_task_banks` is what
makes them readable at interview time. `load()` reads the files; `pick()` reads the rows.
"""

import json
import random
from pathlib import Path

BANK_DIR = Path(__file__).resolve().parent

# Imported exercises do not carry a difficulty rating, and inventing one per exercise would
# be a claim nobody made. One honest label until something measures it.
DIFFICULTY = "gold"


def load() -> list[dict]:
    tasks = []
    for path in sorted(Path(BANK_DIR).glob("*.json")):
        try:
            tasks.append(json.loads(path.read_text()))
        except json.JSONDecodeError:
            continue
    return tasks


def pick(count: int, *, seed: str, language: str = "") -> list[dict]:
    """`count` live tasks, preferring ones available in the candidate's language.

    Seeded by the session, so a retried preparation sets the same interview rather than
    a different one -- and so two candidates in the same seat do not silently get the
    same tasks because the bank happened to be ordered that way. Shuffled in Python
    rather than by `ORDER BY random()`, which is not reproducible from a seed.
    """
    from apps.interview.models import InterviewTask

    rows = InterviewTask.objects.filter(
        kind=InterviewTask.Kind.CODING, retired_at__isnull=True
    ).order_by("slug")

    preferred, rest = [], []
    for row in rows:
        (preferred if language and language in row.languages else rest).append(row.payload)
    if not preferred and not rest:
        return []

    rng = random.Random(seed)
    rng.shuffle(preferred)
    rng.shuffle(rest)
    return (preferred + rest)[:count]
