"""The coding tasks this system can set, as data rather than as a model call.

Each file here is one task, imported and **proved runnable** before it was written: its
reference solution was executed against its own tests in the real sandbox. Nothing lands
here that a candidate could not pass.

Imported exercises carry their source and licence. Exercism's tracks are MIT; the licence
travels with the task rather than living in a note somewhere else, because the attribution
obligation belongs to the content.

Generation stays as the fallback for a resume the bank has nothing suitable for -- and the
bank is where a task should come from when it does, because generating one costs minutes
of an interview and can fail in the middle of it.
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
    """`count` distinct tasks, preferring ones available in the candidate's language.

    Seeded by the session, so a retried generation sets the same interview rather than a
    different one -- and so two candidates in the same seat do not silently get the same
    tasks because the bank happened to be ordered that way.
    """
    tasks = load()
    if not tasks:
        return []

    preferred = [t for t in tasks if language in (t.get("languages") or {})]
    rest = [t for t in tasks if t not in preferred]

    rng = random.Random(seed)
    rng.shuffle(preferred)
    rng.shuffle(rest)
    return (preferred + rest)[:count]
