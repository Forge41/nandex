"""vas's HTTP surface. Plain async function views, manual method dispatch, bare JSON on
success and {"detail": ...} on failure -- the same shape as every other app here.

Only apps.core reaches these, over a bearer token. There is no browser path in.
"""

import json
import logging

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.vas_recordings import services
from apps.vas_recordings.deps import has_service_token
from apps.vas_recordings.models import Recording, VideoSession

logger = logging.getLogger(__name__)


def _parse_body(request: HttpRequest) -> dict:
    return json.loads(request.body) if request.body else {}


def _unauthorized() -> JsonResponse:
    return JsonResponse({"detail": "Authentication required"}, status=401)


def _serialize_session(session: VideoSession) -> dict:
    return {
        "id": session.id,
        "external_session_id": session.external_session_id,
        "room_name": session.room_name,
        "status": session.status,
        "metadata": session.metadata,
        "created_at": session.created_at.isoformat(),
    }


def _serialize_recording(recording: Recording) -> dict:
    return {
        "id": recording.id,
        "egress_id": recording.egress_id,
        "status": recording.status,
        "gcs_bucket": recording.gcs_bucket,
        "gcs_object_key": recording.gcs_object_key,
        "duration_seconds": recording.duration_seconds,
        "file_size_bytes": recording.file_size_bytes,
        "content_type": recording.content_type,
        "checksum": recording.checksum,
        "failure_reason": recording.failure_reason,
        "created_at": recording.created_at.isoformat(),
    }


@csrf_exempt
async def sessions(request: HttpRequest) -> JsonResponse:
    if not has_service_token(request):
        return _unauthorized()
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    body = _parse_body(request)
    external_session_id = body.get("external_session_id")
    room_name = body.get("room_name")
    if not external_session_id or not room_name:
        return JsonResponse(
            {"detail": "external_session_id and room_name are both required"}, status=400
        )

    session = await services.register_session(
        external_session_id, room_name, body.get("metadata") or {}
    )
    return JsonResponse(_serialize_session(session), status=201)


@csrf_exempt
async def session_detail(request: HttpRequest, session_id: str) -> JsonResponse:
    if not has_service_token(request):
        return _unauthorized()
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        session = await services.get_session(session_id)
    except services.VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(_serialize_session(session))


@csrf_exempt
async def recording_start(request: HttpRequest, session_id: str) -> JsonResponse:
    if not has_service_token(request):
        return _unauthorized()
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    body = _parse_body(request)
    try:
        recording = await services.start_recording(
            session_id,
            layout=body.get("layout") or "speaker",
            audio_only=bool(body.get("audio_only")),
        )
    except services.VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(_serialize_recording(recording), status=201)


@csrf_exempt
async def recording_stop(request: HttpRequest, session_id: str) -> JsonResponse:
    if not has_service_token(request):
        return _unauthorized()
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    body = _parse_body(request)
    try:
        recording = await services.stop_recording(session_id, body.get("recording_id"))
    except services.VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(_serialize_recording(recording))


@csrf_exempt
async def recordings(request: HttpRequest, session_id: str) -> JsonResponse:
    if not has_service_token(request):
        return _unauthorized()
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        found = await services.list_recordings(session_id)
    except services.VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse({"recordings": [_serialize_recording(r) for r in found]})


@csrf_exempt
async def recording_detail(
    request: HttpRequest, session_id: str, recording_id: str
) -> JsonResponse:
    if not has_service_token(request):
        return _unauthorized()
    if request.method != "DELETE":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        recording = await services.delete_recording(session_id, recording_id)
    except services.VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(_serialize_recording(recording))


@csrf_exempt
async def playback_url(request: HttpRequest, session_id: str) -> JsonResponse:
    if not has_service_token(request):
        return _unauthorized()
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        result = await services.playback_url(session_id, request.GET.get("recording_id"))
    except services.VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(result)
