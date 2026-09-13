"""Runs inside the container. One file, copied into every runner image.

Contract with the sandbox outside:

- stdin is a tar of the task files, extracted into /work.
- **stderr is the terminal** -- everything the compiler and the tests print, verbatim.
- **stdout is newline-delimited JSON events**, one per line:
    {"event":"line","data":{"kind":"command","text":"$ pytest -q"}}
    {"event":"test","data":{"name":"exact_duplicate","outcome":"pass","durationMs":3}}
    {"event":"result","data":{"phase":"ran","tests":[...]}}

`phase` is `compiled_failed` when nothing ran because the code did not build, `ran`
otherwise. The distinction matters outside: a compile error means zero tests ran, not
every test failed, and it must not cost the candidate a scored attempt.

Test outcomes come from each framework's own machine-readable report -- pytest's JSON
hook, GoogleTest's per-case exit status, JUnit's XML. Nothing here parses a human summary
line into a verdict.
"""

import json
import os
import re
import subprocess
import sys
import tarfile
import time
import xml.etree.ElementTree as ET
from pathlib import Path

WORK = Path("/work")

# The wrapper script points stdout at stderr and leaves fd 3 as a duplicate of the
# container's real stdout, so anything a test prints lands on the terminal and only these
# events reach the event channel. Writing to sys.stdout here would put JSON in the
# candidate's terminal and nothing on the channel.
EVENTS = os.fdopen(3, "w")


def emit(event, data):
    EVENTS.write(json.dumps({"event": event, "data": data}) + "\n")
    EVENTS.flush()


def command(text):
    emit("line", {"kind": "command", "text": f"$ {text}"})


def note(text, kind="muted"):
    emit("line", {"kind": kind, "text": text})


def unpack():
    WORK.mkdir(parents=True, exist_ok=True)
    with tarfile.open(fileobj=sys.stdin.buffer, mode="r|") as archive:
        for member in archive:
            # The tar is written by the runner, not by a candidate, but a traversing
            # path would escape the one writable directory, so it is refused here too.
            if member.name.startswith("/") or ".." in Path(member.name).parts:
                continue
            archive.extract(member, WORK, filter="data")


# Distinct from any exit status a real process can return, so "we stopped it" is never
# confused with "it exited 124".
TIMED_OUT = -1000


def shell(args, timeout_ms, cwd=WORK, env=None):
    """Runs a subprocess with its output going to the terminal as it appears."""
    command(" ".join(args))
    merged = {**os.environ, **(env or {})}
    started = time.monotonic()
    try:
        proc = subprocess.run(
            args,
            cwd=cwd,
            env=merged,
            stdout=sys.stderr,
            stderr=sys.stderr,
            # subprocess closes every descriptor above 2 by default, which would leave
            # an in-process reporter (pytest's plugin) writing to a closed fd 3.
            pass_fds=(3,),
            timeout=timeout_ms / 1000,
            check=False,
        )
        return proc.returncode, int((time.monotonic() - started) * 1000)
    except subprocess.TimeoutExpired:
        note(f"timed out after {timeout_ms} ms", "error")
        return TIMED_OUT, timeout_ms


def canonical(name, language):
    """The case name as the task declared it, whatever the framework calls it.

    pytest requires a `test_` prefix on every function it collects, so a task whose
    canonical case is `window_boundary` is reported as `test_window_boundary`. The panel
    beside the editor lists the canonical names, and a run whose results do not key to
    them shows every case as "not run" -- so the stripping happens here, once, rather
    than in each of the three places that consume a result.
    """
    if language == "python":
        return name.removeprefix("test_")
    return name


def junit_tests(path, language="python"):
    """Per-case results from a JUnit XML report -- pytest, JUnit 5 and GoogleTest all
    write this shape, which is why four languages need one parser."""
    if not path.exists():
        return []
    try:
        root = ET.parse(path).getroot()
    except ET.ParseError:
        return []

    results = []
    for case in root.iter("testcase"):
        failed = any(case.find(tag) is not None for tag in ("failure", "error"))
        skipped = case.find("skipped") is not None
        if skipped:
            continue
        # JUnit reports a Java method as "adds()"; the canonical case list this is
        # checked against uses the bare name, and a mismatch there is a hard failure.
        name = canonical(case.get("name", "").strip().removesuffix("()"), language)
        results.append(
            {
                "name": name,
                "outcome": "fail" if failed else "pass",
                "durationMs": int(float(case.get("time") or 0) * 1000),
            }
        )
    return results


# --------------------------------------------------------------------------- python


def run_python(compile_ms, run_ms):
    report = WORK / "report.xml"
    # The plugin writes an event per test as it finishes, to fd 3 -- which the wrapper
    # script has already pointed at the container's stdout, so these arrive live while
    # pytest's own output goes to the terminal.
    plugin = WORK / "_runner_plugin.py"
    plugin.write_text(PYTEST_PLUGIN)

    code, _ = shell(
        [
            sys.executable,
            "-m",
            "pytest",
            "-q",
            "-p",
            "no:cacheprovider",
            "-p",
            "_runner_plugin",
            f"--junitxml={report}",
            ".",
        ],
        run_ms,
        env={"PYTHONPATH": str(WORK), "PYTHONDONTWRITEBYTECODE": "1"},
    )
    return classify(code, junit_tests(report, "python"))


def classify(code, tests):
    """What happened, from the test process's exit status.

    The four answers are different things and must not collapse into each other. A
    process we stopped did not fail; a process the kernel killed did not fail to compile;
    and code that never built ran no tests at all rather than failing all of them. Only
    the last of those is allowed to cost a candidate nothing, so the distinction is not
    cosmetic.
    """
    if code == TIMED_OUT:
        return {"phase": "timeout", "tests": tests}
    # Negative is a signal: SIGKILL from the memory cgroup, SIGSEGV from the code itself.
    if code < 0:
        return {"phase": "crashed", "tests": tests}
    # pytest: 0 passed, 1 tests failed. Anything else is collection failing -- a syntax
    # error in the candidate's file is an interpreted language's compile error.
    if code not in (0, 1):
        return {"phase": "compile_failed", "tests": []}
    return {"phase": "ran", "tests": tests}


PYTEST_PLUGIN = """
import json, os

_CHANNEL = None


def _out():
    global _CHANNEL
    if _CHANNEL is None:
        _CHANNEL = os.fdopen(3, "w")
    return _CHANNEL


def pytest_runtest_logreport(report):
    if report.when != "call" and not (report.when == "setup" and report.failed):
        return
    channel = _out()
    channel.write(json.dumps({
        "event": "test",
        "data": {
            "name": report.nodeid.rsplit("::", 1)[-1].removeprefix("test_"),
            "outcome": "fail" if report.failed else "pass",
            "durationMs": int(report.duration * 1000),
        },
    }) + "\\n")
    channel.flush()
"""


# ----------------------------------------------------------------------------- java


def run_java(compile_ms, run_ms):
    jar = os.environ["JUNIT_JAR"]
    classes = WORK / "classes"
    classes.mkdir(exist_ok=True)
    sources = sorted(str(p) for p in WORK.glob("*.java"))
    if not sources:
        return {"phase": "compile_failed", "tests": []}

    code, _ = shell(["javac", "-cp", jar, "-d", str(classes), *sources], compile_ms)
    if code != 0:
        return {"phase": "compile_failed", "tests": []}

    reports = WORK / "reports"
    heap = "-XX:MaxRAMPercentage=70"
    code, _ = shell(
        [
            "java",
            heap,
            "-jar",
            jar,
            "execute",
            "--class-path",
            str(classes),
            "--scan-class-path",
            "--details=none",
            "--disable-ansi-colors",
            "--disable-banner",
            f"--reports-dir={reports}",
        ],
        run_ms,
    )
    tests = []
    for report in sorted(reports.glob("*.xml")):
        tests.extend(junit_tests(report, "java"))
    if not tests and code not in (0, 1):
        return {"phase": "crashed", "tests": []}
    for test in tests:
        emit("test", test)
    return {"phase": "ran", "tests": tests}


# -------------------------------------------------------------------------- c / c++


def run_native(compile_ms, run_ms, language):
    binary = WORK / "tests"
    sanitize = "-fsanitize=address,undefined"
    sources = sorted(str(p) for p in WORK.glob("*.cpp"))
    c_sources = sorted(str(p) for p in WORK.glob("*.c"))

    objects = []
    for source in c_sources:
        obj = source + ".o"
        code, _ = shell(
            ["gcc", "-std=c17", "-g", "-O0", sanitize, "-c", source, "-o", obj], compile_ms
        )
        if code != 0:
            return {"phase": "compile_failed", "tests": []}
        objects.append(obj)

    code, _ = shell(
        [
            "g++",
            "-std=c++20",
            "-g",
            "-O0",
            sanitize,
            *sources,
            *objects,
            "-I",
            str(WORK),
            "-lgtest",
            "-lgtest_main",
            "-pthread",
            "-o",
            str(binary),
        ],
        compile_ms,
    )
    if code != 0:
        return {"phase": "compile_failed", "tests": []}

    names = list_gtest_cases(binary, run_ms)
    if not names:
        return {"phase": "crashed", "tests": []}

    # One process per case. GoogleTest writes its XML at exit, so a segfault in the third
    # test would otherwise lose the first two as well -- and the cases after it would
    # have to be reported as something, when the honest answer is that they never ran.
    results = []
    remaining = run_ms
    for name in names:
        if remaining <= 0:
            break
        started = time.monotonic()
        code, elapsed = shell([str(binary), f"--gtest_filter={name}", "--gtest_brief=1"], remaining)
        remaining -= int((time.monotonic() - started) * 1000)
        outcome = "pass" if code == 0 else "fail"
        if code < 0 or code > 128:
            note(f"{name} stopped on signal {abs(code) if code < 0 else code - 128}", "error")
        result = {"name": name.split(".")[-1], "outcome": outcome, "durationMs": elapsed}
        results.append(result)
        emit("test", result)
    return {"phase": "ran", "tests": results}


def list_gtest_cases(binary, timeout_ms):
    try:
        listed = subprocess.run(
            [str(binary), "--gtest_list_tests"],
            cwd=WORK,
            capture_output=True,
            text=True,
            timeout=timeout_ms / 1000,
            check=False,
        )
    except subprocess.TimeoutExpired:
        return []
    names, suite = [], None
    for line in listed.stdout.splitlines():
        if not line.strip() or line.startswith("Running"):
            continue
        if not line.startswith(" "):
            suite = line.strip().rstrip(".")
        elif suite:
            names.append(f"{suite}.{line.strip().split('#')[0].strip()}")
    return names


# ------------------------------------------------------------------------------ sql


def run_sql(compile_ms, run_ms):
    """A real Postgres, started for this run and thrown away with the container.

    The candidate's query is graded here rather than in their browser: a verdict produced
    inside the graded party's own trust boundary is not a verdict.
    """
    data = Path("/work/pgdata")
    code, _ = shell(["initdb", "-D", str(data), "-A", "trust", "-U", "runner"], compile_ms)
    if code != 0:
        return {"phase": "compile_failed", "tests": []}

    code, _ = shell(
        ["pg_ctl", "-D", str(data), "-o", "-k /work -h ''", "-w", "-l", "/work/pg.log", "start"],
        compile_ms,
    )
    if code != 0:
        return {"phase": "compile_failed", "tests": []}

    try:
        env = {"PGHOST": "/work", "PGUSER": "runner", "PGDATABASE": "postgres"}
        for setup in ("schema.sql", "seed.sql"):
            path = WORK / setup
            if path.exists():
                code, _ = shell(["psql", "-v", "ON_ERROR_STOP=1", "-f", str(path)], run_ms, env=env)
                if code != 0:
                    return {"phase": "compile_failed", "tests": []}

        started = time.monotonic()
        code, _ = shell(
            [
                "psql",
                "-v",
                "ON_ERROR_STOP=1",
                "--csv",
                "-f",
                str(WORK / "query.sql"),
                "-o",
                "/work/result.csv",
            ],
            run_ms,
            env=env,
        )
        elapsed = int((time.monotonic() - started) * 1000)
        if code != 0:
            result = {"name": "query runs", "outcome": "fail", "durationMs": elapsed}
            emit("test", result)
            return {"phase": "ran", "tests": [result]}

        rows = Path("/work/result.csv").read_text() if Path("/work/result.csv").exists() else ""
        emit("line", {"kind": "output", "text": rows.strip()[:4000]})
        emit("rows", {"csv": rows[:64_000]})
        result = {"name": "query runs", "outcome": "pass", "durationMs": elapsed}
        emit("test", result)

        expected = WORK / "expected.csv"
        if expected.exists():
            matched = _normalise(rows) == _normalise(expected.read_text())
            check = {
                "name": "result matches",
                "outcome": "pass" if matched else "fail",
                "durationMs": 0,
            }
            emit("test", check)
            return {"phase": "ran", "tests": [result, check]}
        return {"phase": "ran", "tests": [result]}
    finally:
        shell(["pg_ctl", "-D", str(data), "-m", "immediate", "stop"], 10_000)


def _normalise(csv):
    return [re.sub(r"\s+", " ", line).strip() for line in csv.strip().splitlines()]


# ----------------------------------------------------------------------------- main

RUNNERS = {
    "python": run_python,
    "java": run_java,
    "c": lambda c, r: run_native(c, r, "c"),
    "cpp": lambda c, r: run_native(c, r, "cpp"),
    "sql": run_sql,
}


def main():
    language = sys.argv[1]
    budget_ms = int(sys.argv[2])
    compile_ms = int(os.environ.get("RUNNER_COMPILE_MS", budget_ms // 2))
    run_ms = max(budget_ms - compile_ms, 1000)

    unpack()
    runner = RUNNERS.get(language)
    if runner is None:
        emit("result", {"phase": "crashed", "tests": []})
        return 1

    result = runner(compile_ms, run_ms)
    emit("result", result)
    return 0 if result["phase"] == "ran" else 1


if __name__ == "__main__":
    sys.exit(main())
