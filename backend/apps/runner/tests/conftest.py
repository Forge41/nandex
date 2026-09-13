"""Skips the sandbox suite when there is nothing to run it against.

Skipped rather than mocked: what these tests assert is the behaviour of the kernel's
namespaces and cgroups, and a fake Docker would assert nothing about any of it.
"""

import pytest


def pytest_collection_modifyitems(config, items):
    reason = _unavailable()
    if reason is None:
        return
    skip = pytest.mark.skip(reason=reason)
    for item in items:
        if "docker" in item.keywords:
            item.add_marker(skip)


def _unavailable() -> str | None:
    try:
        import docker
    except ImportError:  # pragma: no cover - the dependency is declared
        return "the docker SDK is not installed"
    try:
        client = docker.from_env()
        client.ping()
    except Exception:
        return "no Docker daemon is reachable -- `make up` starts one"
    try:
        client.images.get("nandex-runner-python:latest")
    except Exception:
        return "the runner images are not built -- run `make runner-images`"
    return None
