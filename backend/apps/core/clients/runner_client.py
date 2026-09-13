"""HTTP client for the runner process -- the only thing in this system that talks to it.

Modelled on `vas_client`, with one deliberate difference: **no retry loop**.
`vas_client.MAX_ATTEMPTS = 3` is right for a short buffered JSON call and wrong for a
streaming POST that forks a container. A transport hiccup after the container started
would re-execute the candidate's code and burn a second attempt, and the run they watched
would not be the run that was recorded. A run is attempted once.

The runner's own detail text is logged, never returned: it describes container internals
a candidate has no business seeing.
"""

import json
import logging
from collections.abc import Iterator

import httpx

from apps.core.config import settings

logger = logging.getLogger(__name__)


class RunnerBusy(Exception):
    """The runner is at capacity. Distinct from a failure: trying again works."""


class RunnerUnavailable(Exception):
    """The runner could not be reached, or failed in a way the caller cannot act on."""


def run(*, language: str, files: dict[str, str], budgets: dict | None = None) -> Iterator[dict]:
    """Streams `{"event": ..., "data": ...}` from one sandbox run.

    Always ends on a `done` event, whatever happened -- a caller relaying this to a
    browser must be able to close its own stream on a sentinel.
    """
    url = f"{settings.runner_base_url.rstrip('/')}/runner/runs"
    payload = {"language": language, "files": files, "budgets": budgets or {}}

    try:
        with httpx.stream(
            "POST",
            url,
            json=payload,
            headers={"Authorization": f"Bearer {settings.runner_service_bearer_token}"},
            timeout=httpx.Timeout(settings.runner_timeout_seconds, connect=5.0),
        ) as response:
            if response.status_code == 429:
                raise RunnerBusy("The runner is busy. Try again in a moment.")
            if response.status_code != 200:
                response.read()
                logger.warning("runner returned %d: %s", response.status_code, response.text[:500])
                raise RunnerUnavailable("The code runner is unavailable.")
            yield from _events(response.iter_lines())
    except httpx.HTTPError as e:
        logger.warning("runner transport failure: %s", e)
        raise RunnerUnavailable("The code runner is unavailable.") from e


def _events(lines: Iterator[str]) -> Iterator[dict]:
    event = None
    for line in lines:
        line = line.rstrip("\r")
        if line.startswith("event: "):
            event = line.removeprefix("event: ")
        elif line.startswith("data: ") and event is not None:
            try:
                yield {"event": event, "data": json.loads(line.removeprefix("data: "))}
            except json.JSONDecodeError:
                logger.warning("unparseable runner event for %s", event)
            event = None
