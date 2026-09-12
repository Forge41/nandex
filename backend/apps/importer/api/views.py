"""A user uploading a file directly, with no connected app behind it. The write itself
lives in apps.importer.uploads, which owns RawDocument; this is the HTTP shell around it.
"""

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.api.views import _require_user
from apps.core.models import Project
from apps.core.services.workspace_service import current_workspace_for
from apps.importer.uploads import UploadRejected, create_uploaded_document


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

    try:
        document = await create_uploaded_document(
            project_id=project_id, upload=upload, trigger_ingest=True
        )
    except UploadRejected as e:
        return JsonResponse({"detail": str(e)}, status=400)

    return JsonResponse({"id": document.id}, status=201)
