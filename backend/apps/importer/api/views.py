"""A user uploading a file directly, with no connected app behind it. RawDocument is
immutable and owned by importer (tps never writes it, ingest only reads it) -- so creating
one, from any source, belongs here, not in apps.core or apps.ingest.
"""

import logging

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from temporalio.client import Client

from apps.core.api.views import _require_user
from apps.core.models import Project
from apps.core.services.workspace_service import current_workspace_for
from apps.importer.config import settings
from apps.importer.models import RawDocument, generate_id

# Mirrors apps.ingest.pipeline.parsers.PARSER_REGISTRY's keys exactly -- importer must not
# import apps.ingest (ingest depends on importer, never the reverse), so this list is kept
# in sync by hand. Update both together.
ALLOWED_UPLOAD_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/markdown",
        "text/csv",
    }
)

# A directly-uploaded RawDocument has no real Connection behind it; this constant fills
# the (required, non-FK) connection_id column instead. Uniqueness still holds because
# provider_document_id is freshly generated per upload, never derived from the filename.
UPLOAD_CONNECTION_ID = "upload"


async def _owned_project(request: HttpRequest, project_id: str) -> Project | None:
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return None
    workspace = await sync_to_async(current_workspace_for)(user)
    if workspace is None:
        return None
    try:
        return await Project.objects.aget(id=project_id, workspace=workspace)
    except Project.DoesNotExist:
        return None


def _create_raw_document_sync(
    *, project_id: str, content_type: str, payload: bytes, display_name: str
) -> RawDocument:
    return RawDocument.objects.create(
        connection_id=UPLOAD_CONNECTION_ID,
        project_id=project_id,
        provider_document_id=generate_id(),
        content_type=content_type,
        display_name=display_name,
        payload=payload,
    )


async def _trigger_ingest(raw_document_id: str) -> None:
    """Starts IngesterWorkflow by its registered name, never importing apps.ingest --
    same plain-identifier convention as connection_id/raw_document_id everywhere else in
    this codebase, just applied to a workflow type instead of a database row. Nothing else
    triggers ingestion for this document if this fails (Temporal briefly unreachable,
    etc.) -- there is no sweep to fall back on, so a failure here is a real, logged gap.
    """
    try:
        client = await Client.connect(settings.temporal_address)
        await client.start_workflow(
            "IngesterWorkflow",
            raw_document_id,
            id=f"ingest-{raw_document_id}",
            task_queue=settings.ingest_task_queue,
        )
    except Exception:
        logging.getLogger(__name__).warning(
            "Couldn't start an immediate ingest for %s; no sweep exists to retry it.",
            raw_document_id,
            exc_info=True,
        )


@csrf_exempt
async def upload_document(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    project_id = request.POST.get("project_id")
    if not project_id:
        return JsonResponse({"detail": "project_id is required"}, status=400)

    project = await _owned_project(request, project_id)
    if project is None:
        return JsonResponse({"detail": "Project not found"}, status=404)

    upload = request.FILES.get("file")
    if upload is None:
        return JsonResponse({"detail": "file is required"}, status=400)

    if upload.size > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        return JsonResponse({"detail": f"File exceeds the {limit_mb}MB limit"}, status=400)

    content_type = upload.content_type or ""
    if content_type not in ALLOWED_UPLOAD_CONTENT_TYPES:
        return JsonResponse({"detail": f"Unsupported file type: {content_type}"}, status=400)

    raw_document = await sync_to_async(_create_raw_document_sync, thread_sensitive=True)(
        project_id=project_id,
        content_type=content_type,
        payload=upload.read(),
        display_name=upload.name or "",
    )
    await _trigger_ingest(raw_document.id)
    return JsonResponse({"id": raw_document.id}, status=201)
