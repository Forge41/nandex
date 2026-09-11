import json
import logging

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.vas_compliance import services
from apps.vas_compliance.models import ArtifactDeletion
from apps.vas_recordings.deps import has_service_token
from apps.vas_recordings.services import VasError

logger = logging.getLogger(__name__)


def _serialize(deletion: ArtifactDeletion) -> dict:
    return {
        "id": deletion.id,
        "session_id": deletion.session_id,
        "requested_by": deletion.requested_by,
        "reason": deletion.reason,
        "status": deletion.status,
        "gcs_deleted": deletion.gcs_deleted,
        "completed_at": deletion.completed_at.isoformat() if deletion.completed_at else None,
        "created_at": deletion.created_at.isoformat(),
    }


@csrf_exempt
async def artifacts(request: HttpRequest, session_id: str) -> JsonResponse:
    if not has_service_token(request):
        return JsonResponse({"detail": "Authentication required"}, status=401)
    if request.method != "DELETE":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    body = json.loads(request.body) if request.body else {}
    requested_by = body.get("requested_by")
    if not requested_by:
        return JsonResponse({"detail": "requested_by is required"}, status=400)

    try:
        deletion = await services.request_deletion(
            session_id, requested_by, body.get("reason") or ""
        )
    except VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(_serialize(deletion), status=202)


@csrf_exempt
async def deletion_detail(request: HttpRequest, session_id: str, deletion_id: str) -> JsonResponse:
    if not has_service_token(request):
        return JsonResponse({"detail": "Authentication required"}, status=401)
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    try:
        deletion = await services.get_deletion(deletion_id)
    except VasError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(_serialize(deletion))
