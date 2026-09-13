"""Turns an Exercism exercise into a task this system can set.

Exercism's tracks are MIT licensed and ship exactly what a runnable task needs: a stub the
candidate edits, a test file, and a reference solution under `.meta/`. That reference is
what makes importing safe -- every exercise is run here before it is stored, so a task that
cannot be passed never reaches a candidate.

Each track brings its own test framework, and that is fine because each track **vendors**
it: Unity arrives inside the C exercise, Catch2 inside the C++ one. The runner images carry
no framework they were not given.

Fetched at import time, not at interview time. The network is not on the path of an
interview, and a task that changed under a candidate mid-round would be worse than a stale
one.
"""

from __future__ import annotations

import logging
import re
import urllib.request

logger = logging.getLogger(__name__)

# Raw file access rather than the contents API: importing one exercise reads about forty
# files across four tracks, and the API's unauthenticated allowance is sixty an hour --
# so a single run of this command would exhaust it and the rest would fail as rate limits
# rather than as missing exercises.
RAW = "https://raw.githubusercontent.com/exercism/{track}/main/exercises/practice/{slug}/{path}"

LICENCE = "Exercism (https://exercism.org), MIT"


class ExerciseUnavailable(Exception):
    """The track does not have this exercise, or GitHub would not give it to us."""


def _slug_to_class(slug: str) -> str:
    return "".join(part.capitalize() for part in slug.split("-"))


def _snake(slug: str) -> str:
    return slug.replace("-", "_")


def layout(track: str, slug: str) -> dict:
    """Which files to fetch, and what each becomes.

    `solution` is the file the candidate edits, `tests` the one they may not, `extra` the
    supporting files that go into the container unchanged (headers, vendored frameworks),
    and `reference` the answer used to prove the exercise is passable.
    """
    snake, klass = _snake(slug), _slug_to_class(slug)
    if track == "python":
        return {
            "solution": f"{snake}.py",
            "tests": f"{snake}_test.py",
            "extra": [],
            "reference": ".meta/example.py",
        }
    if track == "java":
        return {
            "solution": f"src/main/java/{klass}.java",
            "tests": f"src/test/java/{klass}Test.java",
            "extra": [],
            "reference": f".meta/src/reference/java/{klass}.java",
            # Flattened: the harness compiles every .java in one directory, and Exercism's
            # exercises are unpackaged, so the Gradle tree carries no meaning here.
            "rename": {
                f"src/main/java/{klass}.java": f"{klass}.java",
                f"src/test/java/{klass}Test.java": f"{klass}Test.java",
            },
        }
    if track == "c":
        return {
            "solution": f"{snake}.c",
            "tests": f"test_{snake}.c",
            "extra": [
                f"{snake}.h",
                "test-framework/unity.c",
                "test-framework/unity.h",
                "test-framework/unity_internals.h",
            ],
            "reference": ".meta/example.c",
        }
    if track == "cpp":
        return {
            "solution": f"{snake}.cpp",
            "tests": f"{snake}_test.cpp",
            "extra": [f"{snake}.h", "test/catch.hpp", "test/tests-main.cpp"],
            "reference": ".meta/example.cpp",
            # The C++ track's reference sometimes replaces the header too.
            "optional": {".meta/example.h": f"{snake}.h"},
        }
    raise ExerciseUnavailable(f"unsupported track {track}")


def fetch(track: str, slug: str, path: str) -> str:
    url = RAW.format(track=track, slug=slug, path=path)
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.read().decode("utf-8")
    except Exception as e:
        raise ExerciseUnavailable(f"{track}/{slug}/{path}: {e}") from e


# Exercism hands a learner one failing test at a time: the rest are disabled, and part of
# the exercise is turning them on. An interview is not a learning track -- a candidate is
# answering the whole task at once, and the panel lists every case -- so the guards come
# off at import. C++ does it with a compile-time define, handled in the harness.
ENABLE = {
    "java": (re.compile(r"^\s*@Disabled\([^)]*\)\s*$", re.MULTILINE), ""),
    "c": (re.compile(r"^\s*TEST_IGNORE\(\);.*$", re.MULTILINE), ""),
}


def enable_all(content: str, track: str) -> str:
    rule = ENABLE.get(track)
    return rule[0].sub(rule[1], content) if rule else content


def variant(track: str, slug: str) -> dict:
    """One language's files, plus the reference solution kept out of them.

    The reference is returned separately and never stored on the task: it is used once, to
    prove the exercise can be passed, and a candidate must never receive it.
    """
    spec = layout(track, slug)
    rename = spec.get("rename", {})
    language = track

    def named(path: str) -> str:
        return rename.get(path, path)

    files = [
        {
            "name": named(spec["solution"]),
            "language": language,
            "content": fetch(track, slug, spec["solution"]),
            "readOnly": False,
        },
        {
            "name": named(spec["tests"]),
            "language": language,
            "content": enable_all(fetch(track, slug, spec["tests"]), track),
            "readOnly": True,
        },
    ]
    for path in spec["extra"]:
        files.append(
            {
                "name": named(path),
                "language": language,
                "content": fetch(track, slug, path),
                "readOnly": True,
                # Vendored frameworks and headers belong in the container and nowhere
                # near the candidate's file tabs.
                "hidden": path.startswith(("test-framework/", "test/")),
            }
        )

    reference = fetch(track, slug, spec["reference"])
    overrides = []
    for source, target in (spec.get("optional") or {}).items():
        try:
            overrides.append({"name": target, "content": fetch(track, slug, source)})
        except ExerciseUnavailable:
            continue
    return {"files": files, "reference": reference, "referenceExtra": overrides}


def instructions(slug: str) -> list[str]:
    """The exercise's own description, as the paragraphs of a brief."""
    raw = fetch("python", slug, ".docs/instructions.md")
    body = re.sub(r"^#.*$", "", raw, flags=re.MULTILINE)
    paragraphs = [
        re.sub(r"\s+", " ", block).strip()
        for block in body.split("\n\n")
        if block.strip() and not block.strip().startswith(("```", "|", ">"))
    ]
    return [p for p in paragraphs if len(p) > 30][:4]


def title(slug: str) -> str:
    return slug.replace("-", " ").capitalize()
