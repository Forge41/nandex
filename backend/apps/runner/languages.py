"""What each supported language needs from a container.

One entry per language, and nothing outside this table knows a language name. Adding a
fifth is a row here plus an image; the sandbox, the API and the event contract do not
change.

Budgets are separated because three of the four compile before anything runs. A single
shared ceiling would fail C++ for reasons that have nothing to do with the candidate --
javac plus JVM start is a second or two, and a GoogleTest link is several.

Memory is per language for the same reason: a JVM in a 256 MB cgroup dies on startup, so
it is given room and told the limit rather than left to discover it by being killed.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Language:
    id: str
    label: str
    image: str
    compile_ms: int
    run_ms: int
    memory_mb: int
    # Scratch space, for the same reason memory is per language: a compiler needs room to
    # write intermediate output, and a single-header test framework needs a great deal of
    # it. Too small shows up as a compile error about the device being full, which reads
    # like the candidate's fault and is not.
    work_mb: int
    tmp_mb: int
    # The file a candidate edits, and the one they may not. Core enforces this; the
    # runner records it so a task generated for the wrong shape fails loudly here too.
    default_solution: str
    default_tests: str
    # Passed to the in-image harness, which is the only thing that knows how to build
    # and run this language.
    harness: str


LANGUAGES: dict[str, Language] = {
    "python": Language(
        id="python",
        label="Python",
        image="nandex-runner-python:latest",
        compile_ms=5_000,
        run_ms=15_000,
        memory_mb=256,
        work_mb=64,
        tmp_mb=32,
        default_solution="solution.py",
        default_tests="test_solution.py",
        harness="python",
    ),
    "java": Language(
        id="java",
        label="Java",
        image="nandex-runner-java:latest",
        compile_ms=45_000,
        run_ms=30_000,
        # A JVM inside 256 MB dies before main(); -XX:MaxRAMPercentage in the harness
        # tells it about this number rather than letting it find out by being killed.
        memory_mb=768,
        work_mb=256,
        tmp_mb=128,
        default_solution="Solution.java",
        default_tests="SolutionTest.java",
        harness="java",
    ),
    "c": Language(
        id="c",
        label="C",
        image="nandex-runner-cpp:latest",
        compile_ms=60_000,
        run_ms=20_000,
        # AddressSanitizer's shadow map wants considerably more than the program does.
        memory_mb=1024,
        work_mb=512,
        tmp_mb=512,
        default_solution="solution.c",
        default_tests="test_solution.cpp",
        harness="c",
    ),
    "cpp": Language(
        id="cpp",
        label="C++",
        image="nandex-runner-cpp:latest",
        compile_ms=60_000,
        run_ms=20_000,
        memory_mb=1024,
        work_mb=512,
        tmp_mb=512,
        default_solution="solution.cpp",
        default_tests="test_solution.cpp",
        harness="cpp",
    ),
    "sql": Language(
        id="sql",
        label="SQL",
        image="nandex-runner-sql:latest",
        # initdb and a server start, before a single statement runs.
        compile_ms=60_000,
        run_ms=20_000,
        memory_mb=512,
        work_mb=512,
        tmp_mb=128,
        default_solution="query.sql",
        default_tests="schema.sql",
        harness="sql",
    ),
}


def get(language_id: str) -> Language | None:
    return LANGUAGES.get(language_id)
