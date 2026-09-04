import json

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.auth.service import logout_current, request_magic_link, verify_and_login
from apps.core.models import Project
from apps.core.services.project_service import create_project, list_projects, update_project
from apps.core.services.workspace_service import current_workspace_for


def _parse_body(request: HttpRequest) -> dict:
    return json.loads(request.body) if request.body else {}


@csrf_exempt
async def request_login(request: HttpRequest) -> JsonResponse:
    body = _parse_body(request)
    email = body.get("email")
    if not email:
        return JsonResponse({"detail": "email is required"}, status=400)
    await sync_to_async(request_magic_link)(email)
    return JsonResponse({"ok": True})


@csrf_exempt
async def verify_login(request: HttpRequest) -> JsonResponse:
    body = _parse_body(request)
    token = body.get("token")
    if not token:
        return JsonResponse({"detail": "token is required"}, status=400)
    try:
        user, workspace, is_new_user = await sync_to_async(verify_and_login, thread_sensitive=True)(
            request, token
        )
    except ValueError as e:
        return JsonResponse({"detail": str(e)}, status=401)
    return JsonResponse(
        {
            "user": {"id": user.id, "email": user.email},
            "workspace": {"id": workspace.id, "slug": workspace.slug},
            "is_new_user": is_new_user,
        }
    )


@csrf_exempt
async def logout_view(request: HttpRequest) -> JsonResponse:
    await sync_to_async(logout_current)(request)
    return JsonResponse({"ok": True})


def _require_user(request: HttpRequest):
    if not request.user.is_authenticated:
        return None
    return request.user


def _serialize_project(project: Project) -> dict:
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at.isoformat(),
    }


@csrf_exempt
async def projects(request: HttpRequest) -> JsonResponse:
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    workspace = await sync_to_async(current_workspace_for)(user)
    if workspace is None:
        return JsonResponse({"detail": "No workspace found"}, status=404)

    if request.method == "POST":
        body = _parse_body(request)
        if not body.get("name"):
            return JsonResponse({"detail": "name is required"}, status=400)
        project = await sync_to_async(create_project)(
            workspace, body["name"], body.get("description", "")
        )
        return JsonResponse(_serialize_project(project), status=201)

    project_list = await sync_to_async(lambda: list(list_projects(workspace)))()
    return JsonResponse([_serialize_project(p) for p in project_list], safe=False)


@csrf_exempt
async def project_detail(request: HttpRequest, project_id: str) -> JsonResponse:
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    workspace = await sync_to_async(current_workspace_for)(user)
    if workspace is None:
        return JsonResponse({"detail": "No workspace found"}, status=404)

    try:
        project = await Project.objects.aget(id=project_id, workspace=workspace)
    except Project.DoesNotExist:
        return JsonResponse({"detail": "Project not found"}, status=404)

    if request.method == "PATCH":
        body = _parse_body(request)
        project = await sync_to_async(update_project)(
            project, body.get("name"), body.get("description")
        )
        return JsonResponse(_serialize_project(project))

    if request.method == "DELETE":
        await project.adelete()
        return JsonResponse({"ok": True})

    return JsonResponse(_serialize_project(project))
