"""The receiver for vas's callbacks.

Cookie-less and retried, which is why its path is in
settings.ANONYMOUS_AUTOPROVISION_EXEMPT_PREFIXES: without that, every retry would mint a
throwaway User, Workspace and Project.

The order of operations is the whole security of this endpoint: read request.body first,
verify the signature against those exact bytes, and only then parse JSON.
"""

import json
import logging

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.services.room_service import verify_callback_signature
from apps.interview import services
from apps.interview.models import InterviewSession

logger = logging.getLogger(__name__)


@csrf_exempt
async def vas_callback(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    raw_body = request.body
    if not verify_callback_signature(
        raw_body,
        request.META.get("HTTP_X_VAS_SIGNATURE", ""),
        request.META.get("HTTP_X_VAS_TIMESTAMP", ""),
    ):
        logger.warning("Rejected a vas callback")
        return JsonResponse({"detail": "Invalid signature"}, status=401)

    try:
        payload = json.loads(raw_body) if raw_body else {}
    except ValueError:
        return JsonResponse({"detail": "Invalid body"}, status=400)

    event = payload.get("event")
    external_session_id = payload.get("external_session_id")
    session = None
    if external_session_id:
        session = await InterviewSession.objects.filter(id=external_session_id).afirst()

    # An unknown event or an unknown session is answered 200, not 4xx: vas retries a
    # failure, and it would retry forever over something we will never process.
    if session is None:
        logger.info("Ignoring a vas callback for unknown session %r", external_session_id)
        return JsonResponse({"received": True})

    if event == "recording.complete":
        await _handle_recording_complete(session, payload.get("recording") or {})
    elif event == "artifacts.deleted":
        logger.info("vas deleted the artifacts for session %s", session.id)
    else:
        logger.info("Ignoring unhandled vas event %r", event)

    return JsonResponse({"received": True})


async def _handle_recording_complete(session: InterviewSession, recording: dict) -> None:
    await sync_to_async(services.record_recording_sync, thread_sensitive=True)(session, recording)

    state = (
        InterviewSession.RecordingState.FAILED
        if recording.get("status") == "failed"
        else InterviewSession.RecordingState.STOPPED
    )
    if session.recording_state != state:
        session.recording_state = state
        await session.asave(update_fields=["recording_state", "updated_at"])

    # Deterministic workflow id, so this and /end can both trigger without double-running.
    await services.trigger_post_session_processing(session.id)
