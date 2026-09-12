"""HTTP client for the vas process -- the only thing in this system that talks to it.

vas shares this project and this database, but the boundary is HTTP on purpose: it is a
separate deployable, and a direct import or an ORM relation would weld the two together
permanently. See the leaf rule in AGENTS.md.

Every error is translated into VasUnavailable, whose message is safe to show a browser.
vas's own detail text is logged, never returned -- it describes internal state a candidate
has no business seeing.
"""

import asyncio
import logging
from typing import Any

import httpx

from apps.core.config import settings

logger = logging.getLogger(__name__)

MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 0.25
# Retrying a 4xx just repeats the same rejection; only a transport failure or vas's own
# 5xx can plausibly succeed on a second try.
RETRYABLE_STATUS_FLOOR = 500


class VasError(Exception):
    """A request vas understood and refused. status is vas's own, and is meaningful to
    the caller: a 409 on a recording start really does mean one is already running."""

    def __init__(self, status: int, detail: str) -> None:
        super().__init__(detail)
        self.status = status
        self.detail = detail


class VasUnavailable(Exception):
    """vas could not be reached, or failed in a way the caller cannot act on."""


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.vas_service_bearer_token}",
        "Content-Type": "application/json",
    }


async def _request(
    method: str, path: str, *, json: dict | None = None, params: dict | None = None
) -> Any:
    url = f"{settings.vas_base_url.rstrip('/')}{path}"
    last_error: Exception | None = None

    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.vas_timeout_seconds) as client:
                response = await client.request(
                    method, url, headers=_headers(), json=json, params=params
                )
        except httpx.TransportError as e:
            last_error = e
            logger.warning("vas %s %s attempt %d: %s", method, path, attempt, e)
        else:
            if response.status_code < RETRYABLE_STATUS_FLOOR:
                return _decode(method, path, response)
            last_error = VasUnavailable(f"vas returned {response.status_code}")
            logger.warning(
                "vas %s %s attempt %d returned %d: %s",
                method,
                path,
                attempt,
                response.status_code,
                response.text[:500],
            )

        if attempt < MAX_ATTEMPTS:
            await asyncio.sleep(BACKOFF_BASE_SECONDS * 2 ** (attempt - 1))

    raise VasUnavailable("Video service unavailable") from last_error


def _decode(method: str, path: str, response: httpx.Response) -> Any:
    # The body is read before raise_for_status would discard it: vas's {"detail": ...}
    # carries the reason a 409 or 404 happened, which the caller needs to map.
    try:
        body = response.json() if response.content else {}
    except ValueError:
        logger.warning("vas %s %s returned a non-JSON body", method, path)
        raise VasUnavailable("Video service returned an unreadable response") from None

    if response.status_code >= 400:
        detail = body.get("detail") if isinstance(body, dict) else None
        raise VasError(response.status_code, detail or "Video service refused the request")
    return body


async def register_session(
    external_session_id: str,
    room_name: str,
    metadata: dict | None = None,
    auto_record: bool = False,
) -> dict:
    """Idempotent on external_session_id, so this is safe to call on every token mint
    rather than needing a separate provisioning step.

    auto_record asks vas to start recording once the provider reports the room started.
    A provider room does not exist until its first participant joins, and Egress answers
    not_found for one that is not there -- so a recording cannot be started at the moment
    a token is minted. This is how it is asked for in advance instead.
    """
    return await _request(
        "POST",
        "/video/sessions",
        json={
            "external_session_id": external_session_id,
            "room_name": room_name,
            "metadata": metadata or {},
            "auto_record": auto_record,
        },
    )


async def get_session(vas_session_id: str) -> dict:
    return await _request("GET", f"/video/sessions/{vas_session_id}")


async def start_recording(
    vas_session_id: str, layout: str = "speaker", audio_only: bool = False
) -> dict:
    return await _request(
        "POST",
        f"/video/sessions/{vas_session_id}/recording/start",
        json={"layout": layout, "audio_only": audio_only},
    )


async def stop_recording(vas_session_id: str, recording_id: str | None = None) -> dict:
    return await _request(
        "POST",
        f"/video/sessions/{vas_session_id}/recording/stop",
        json={"recording_id": recording_id},
    )


async def list_recordings(vas_session_id: str) -> list[dict]:
    body = await _request("GET", f"/video/sessions/{vas_session_id}/recordings")
    return body.get("recordings", [])


async def playback_url(vas_session_id: str, recording_id: str | None = None) -> dict:
    return await _request(
        "GET",
        f"/video/sessions/{vas_session_id}/playback-url",
        params={"recording_id": recording_id} if recording_id else None,
    )


async def request_artifact_deletion(
    vas_session_id: str, requested_by: str, reason: str = ""
) -> dict:
    return await _request(
        "DELETE",
        f"/video/sessions/{vas_session_id}/artifacts",
        json={"requested_by": requested_by, "reason": reason},
    )
