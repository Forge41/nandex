"""Read-only status for a single ingest -- lets the uploader poll "uploading -> indexing ->
ready" instead of blindly waiting, since IngesterWorkflow runs asynchronously once triggered.
ingest may read apps.importer's RawDocument directly (its own pipeline entrypoint already
does), just never write it.
"""

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.api.views import _require_user
from apps.core.models import Project
from apps.core.services.workspace_service import current_workspace_for
from apps.importer.models import RawDocument
from apps.ingest.config import settings
from apps.ingest.models import IngestRun


@csrf_exempt
async def ingest_status(request: HttpRequest, raw_document_id: str) -> JsonResponse:
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    project_id = request.GET.get("project_id")
    if not project_id:
        return JsonResponse({"detail": "project_id is required"}, status=400)

    workspace = await sync_to_async(current_workspace_for)(user)
    if workspace is None:
        return JsonResponse({"detail": "Project not found"}, status=404)
    try:
        await Project.objects.aget(id=project_id, workspace=workspace)
    except Project.DoesNotExist:
        return JsonResponse({"detail": "Project not found"}, status=404)

    try:
        raw_document = await RawDocument.objects.aget(id=raw_document_id, project_id=project_id)
    except RawDocument.DoesNotExist:
        return JsonResponse({"detail": "Document not found"}, status=404)

    run = (
        await IngestRun.objects.filter(
            raw_document_id=raw_document.id, pipeline_version=settings.pipeline_version
        )
        .order_by("-started_at")
        .afirst()
    )
    if run is None:
        return JsonResponse({"status": "pending"})

    return JsonResponse({"status": run.status, "error_message": run.error_message})
