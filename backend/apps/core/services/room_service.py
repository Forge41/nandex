"""Live-room capabilities, composed by whatever feature needs them.

Deliberately free of interview semantics: no consent logic, no round state, no notion of
a candidate. It knows about rooms, identities, grants and recordings. apps.interview
supplies the meaning and calls these; nothing here may grow a feature's vocabulary.

This is also the only module that knows both halves -- tps for tokens, vas for
recordings. Callers above it never reach either directly.
"""

import hashlib
import hmac
import logging
import time

from apps.core.clients import tps_client, vas_client
from apps.core.config import settings

logger = logging.getLogger(__name__)

# The realtime provider to act with. A per-project override lands in tps, not here: tps
# already resolves a project's own Connection before falling back to platform
# credentials, so provider choice never becomes core's concern.
REALTIME_APP_NAME = "livekit"

DEFAULT_TOKEN_TTL_SECONDS = 900
# The signature covers the raw bytes plus a timestamp, so a captured callback can only be
# replayed inside this window. There is no nonce cache -- the repo has no cache backend,
# and the handlers are idempotent, which is the real defence.
CALLBACK_MAX_SKEW_SECONDS = 300


class RoomUnavailable(Exception):
    """The room could not be provisioned. Safe to show a caller; the upstream reason is
    logged instead of propagated."""


async def mint_join_token(
    project_id: str,
    room: str,
    identity: str,
    *,
    can_publish: bool = True,
    can_subscribe: bool = True,
    hidden: bool = False,
    ttl_seconds: int = DEFAULT_TOKEN_TTL_SECONDS,
    agents: tuple[tuple[str, str], ...] = (),
) -> dict:
    """Returns {token, ws_url, expires_in}.

    identity is whatever the caller passes; deriving it from something the browser cannot
    influence is the caller's responsibility, and the reason this function does not accept
    a request object.
    """
    try:
        return await tps_client.mint_room_token(
            project_id=project_id,
            app_name=REALTIME_APP_NAME,
            room=room,
            identity=identity,
            can_publish=can_publish,
            can_subscribe=can_subscribe,
            hidden=hidden,
            ttl_seconds=ttl_seconds,
            agents=agents,
        )
    except Exception as e:
        logger.warning("Couldn't mint a room token for %s", room, exc_info=True)
        raise RoomUnavailable("Video service unavailable") from e


async def ensure_artifact_session(external_session_id: str, room_name: str, metadata: dict | None = None) -> str:
    """Registers the room with vas if it isn't already, and returns the vas session id.

    Idempotent, because vas keys on external_session_id -- so a caller can do this lazily
    on first use rather than maintaining a separate provisioning step.
    """
    try:
        session = await vas_client.register_session(external_session_id, room_name, metadata)
    except (vas_client.VasError, vas_client.VasUnavailable) as e:
        logger.warning("Couldn't register %s with vas", external_session_id, exc_info=True)
        raise RoomUnavailable("Video service unavailable") from e
    return session["id"]


async def start_recording(vas_session_id: str, *, layout: str = "speaker", audio_only: bool = False) -> dict:
    return await vas_client.start_recording(vas_session_id, layout=layout, audio_only=audio_only)


async def stop_recording(vas_session_id: str, recording_id: str | None = None) -> dict:
    return await vas_client.stop_recording(vas_session_id, recording_id)


async def list_recordings(vas_session_id: str) -> list[dict]:
    return await vas_client.list_recordings(vas_session_id)


async def playback_url(vas_session_id: str, recording_id: str | None = None) -> dict:
    return await vas_client.playback_url(vas_session_id, recording_id)


async def request_artifact_deletion(vas_session_id: str, requested_by: str, reason: str = "") -> dict:
    return await vas_client.request_artifact_deletion(vas_session_id, requested_by, reason)


def verify_callback_signature(
    raw_body: bytes, signature_header: str, timestamp_header: str
) -> bool:
    """raw_body must be request.body.

    vas signs the exact bytes it emitted, so json.dumps of the parsed dict will not match:
    it differs in key order and separator whitespace. Verify before parsing, always.

    Returns the same False for every failure mode -- bad signature, stale timestamp,
    malformed header -- so a caller cannot use the outcome to tell them apart.
    """
    secret = settings.vas_callback_signing_secret
    if not secret:
        # An unset secret must reject rather than accept everything: a misconfigured
        # deployment should drop callbacks, not trust anonymous ones.
        logger.error("CORE_VAS_CALLBACK_SIGNING_SECRET is unset -- rejecting the callback")
        return False

    try:
        timestamp = int(timestamp_header)
    except (TypeError, ValueError):
        return False

    if abs(time.time() - timestamp) > CALLBACK_MAX_SKEW_SECONDS:
        return False

    presented = signature_header.removeprefix("sha256=")
    if not presented:
        return False

    message = b"callback:" + raw_body + b":" + timestamp_header.encode()
    expected = hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()
    return hmac.compare_digest(presented, expected)
