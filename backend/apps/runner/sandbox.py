"""Runs one set of files in one throwaway container and streams what happens.

The isolation is the point, so it is stated in one place rather than spread across
callers: no network, read-only rootfs, a non-root uid, dropped capabilities, a pid
ceiling, a memory ceiling, and a wall-clock budget enforced with SIGKILL. Candidate code
reaches none of Postgres, LiveKit, the metadata service or the internet.

Files arrive as a tar on the container's stdin rather than a bind mount, so no path on
this host is reachable from inside. Results leave on the two streams Docker actually
carries: **stderr is the terminal** (whatever the compiler and the test binary print) and
**stdout is newline-delimited JSON events**. An earlier design used file descriptors 3
and 4 for the events; Docker's attach multiplexes exactly two streams and silently drops
anything else, so the split had to live inside those two.

Nothing here parses human output into a verdict. Every event on stdout is written by the
in-image harness, which asks the test framework directly.
"""

from __future__ import annotations

import contextlib
import io
import json
import logging
import socket
import tarfile
import threading
import time
from collections.abc import Iterator
from dataclasses import dataclass

import docker
from docker.errors import DockerException, ImageNotFound

from apps.runner.config import settings
from apps.runner.languages import Language

logger = logging.getLogger(__name__)

# Docker's own exit codes for a killed process. 137 is SIGKILL, which is what the budget
# and the memory cgroup both produce -- indistinguishable from outside, so the harness's
# own last event is what tells them apart when it got one out.
SIGKILL_EXIT = 137


class SandboxUnavailable(Exception):
    """The daemon could not be reached, or the image is missing."""


@dataclass
class RunSpec:
    language: Language
    files: dict[str, str]
    compile_ms: int
    run_ms: int


def run(spec: RunSpec) -> Iterator[dict]:
    """Yields `{"event": ..., "data": ...}` until the container is gone.

    The final event is always `done`, including on every failure path -- a caller that
    relays this to a browser must be able to end the stream on one sentinel rather than
    on the absence of further output.
    """
    started = time.monotonic()
    budget_ms = min(spec.compile_ms + spec.run_ms, settings.max_budget_ms)

    try:
        client = _client()
    except DockerException as e:
        raise SandboxUnavailable(str(e)) from e

    try:
        container = client.containers.create(**_container_args(spec, budget_ms))
    except ImageNotFound as e:
        raise SandboxUnavailable(f"the {spec.language.id} runner image is not built") from e
    except DockerException as e:
        raise SandboxUnavailable(str(e)) from e

    killer = threading.Timer(budget_ms / 1000, _kill, args=(container,))
    truncated = False
    timed_out = False
    tests: list[dict] = []
    harness_result: dict | None = None

    try:
        # Two connections, deliberately. Writing stdin and reading output over one
        # hijacked socket loses output on some daemons; docker-py's own attach() handles
        # the stream framing, and `logs=True` replays anything written before we got here.
        stdin_socket = container.attach_socket(params={"stdin": 1, "stream": 1})
        container.start()
        killer.start()

        raw = stdin_socket._sock
        raw.sendall(_tar(spec.files))
        raw.shutdown(socket.SHUT_WR)
        raw.close()

        seen = 0
        for out, err in container.attach(
            stdout=True, stderr=True, stream=True, demux=True, logs=True
        ):
            seen += len(out or b"") + len(err or b"")
            if seen > settings.max_output_bytes:
                truncated = True
                _kill(container)
                break
            if err:
                for line in err.decode("utf-8", "replace").splitlines():
                    yield {"event": "line", "data": {"kind": "output", "text": line}}
            if out:
                for event in _events(out):
                    if event.get("event") == "test":
                        tests.append(event["data"])
                        yield event
                    elif event.get("event") == "result":
                        harness_result = event["data"]
                    else:
                        yield event

        exit_code = container.wait(timeout=10).get("StatusCode", SIGKILL_EXIT)
    except DockerException as e:
        logger.warning("sandbox failed for %s: %s", spec.language.id, e)
        raise SandboxUnavailable(str(e)) from e
    finally:
        killer.cancel()
        _remove(container)

    elapsed_ms = int((time.monotonic() - started) * 1000)
    timed_out = exit_code == SIGKILL_EXIT and not truncated and elapsed_ms >= budget_ms * 0.9

    yield {
        "event": "done",
        "data": _done(harness_result, tests, exit_code, elapsed_ms, truncated, timed_out),
    }


def _done(
    harness: dict | None,
    streamed: list[dict],
    exit_code: int,
    elapsed_ms: int,
    truncated: bool,
    timed_out: bool,
) -> dict:
    """The verdict.

    The harness's own reconciled result wins when it produced one. When it did not -- a
    segfault, an out-of-memory kill, the budget -- the events already streamed are the
    result, and every case that never reported stays absent rather than becoming a
    failure. A test that did not run has no outcome; saying otherwise about a candidate's
    code is the thing this whole round is being rebuilt to stop doing.
    """
    if harness is not None:
        phase = harness.get("phase", "ran")
        reconciled = harness.get("tests") or []
        # The reconciled report is authoritative when there is one, but a run that died
        # mid-suite leaves none -- and the cases that already reported are still true.
        # Falling back to them is what keeps a crash from erasing the work before it.
        tests = _merge(reconciled, streamed)
    else:
        phase = "crashed" if not timed_out and exit_code != 0 else "ran"
        tests = streamed

    return {
        "phase": "timeout" if timed_out else phase,
        "tests": tests,
        "exitCode": exit_code,
        "durationMs": elapsed_ms,
        "truncated": truncated,
        "timedOut": timed_out,
    }


def _merge(reconciled: list[dict], streamed: list[dict]) -> list[dict]:
    """Reconciled results win per case; streamed ones fill the gaps they leave."""
    by_name = {t["name"]: t for t in streamed if t.get("name")}
    by_name.update({t["name"]: t for t in reconciled if t.get("name")})
    ordered = [t for t in streamed if t.get("name")]
    ordered += [t for t in reconciled if t.get("name") not in {s.get("name") for s in streamed}]
    return [by_name[t["name"]] for t in ordered]


def _container_args(spec: RunSpec, budget_ms: int) -> dict:
    language = spec.language
    return {
        "image": language.image,
        "command": [language.harness, str(budget_ms)],
        "stdin_open": True,
        "network_disabled": True,
        "network_mode": "none",
        "read_only": True,
        "user": "65534:65534",
        "mem_limit": f"{language.memory_mb}m",
        "memswap_limit": f"{language.memory_mb}m",
        "nano_cpus": 1_000_000_000,
        "pids_limit": 64,
        "cap_drop": ["ALL"],
        "security_opt": ["no-new-privileges"],
        # exec, because the rootfs is read-only and a compiled test binary has nowhere
        # else it could live.
        # mode=1777 because the container runs as an unprivileged uid and a tmpfs is
        # created root-owned: without it the harness cannot write the files it is given.
        "tmpfs": {
            "/work": f"rw,exec,nosuid,size={language.work_mb}m,mode=1777",
            "/tmp": f"rw,nosuid,size={language.tmp_mb}m,mode=1777",
        },
        "environment": {
            "HOME": "/work",
            "RUNNER_MEMORY_MB": str(language.memory_mb),
            "RUNNER_COMPILE_MS": str(spec.compile_ms),
            # A sanitizer report should fail its own test and let the suite continue;
            # halting on the first one leaves every later case unreported.
            "ASAN_OPTIONS": "halt_on_error=0:detect_leaks=0",
            "UBSAN_OPTIONS": "halt_on_error=0:print_stacktrace=1",
        },
        "detach": True,
    }


def _client():
    if settings.docker_host:
        return docker.DockerClient(base_url=settings.docker_host)
    return docker.from_env()


def _tar(files: dict[str, str]) -> bytes:
    buffer = io.BytesIO()
    with tarfile.open(fileobj=buffer, mode="w") as archive:
        for name, content in files.items():
            payload = content.encode("utf-8")
            info = tarfile.TarInfo(name=name)
            info.size = len(payload)
            info.mode = 0o644
            archive.addfile(info, io.BytesIO(payload))
    return buffer.getvalue()


def _events(chunk: bytes) -> Iterator[dict]:
    for line in chunk.decode("utf-8", "replace").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            # The harness is ours, so this is a bug rather than candidate input -- but a
            # malformed line must not take the run down with it.
            logger.warning("unparseable harness event: %r", line[:200])


def _kill(container) -> None:
    # Already dead is the common case, and indistinguishable from here.
    with contextlib.suppress(DockerException):
        container.kill()


def _remove(container) -> None:
    with contextlib.suppress(DockerException):
        container.remove(force=True)
