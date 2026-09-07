"""Wires up apps.core.clients.tps_client -- built alongside apps.core originally, never
called from anywhere until now. tps_client itself does no authorization; every project_id
here is re-checked against the caller's workspace the same way project_detail already does,
since that's the only place authorization can happen.
"""

from asgiref.sync import sync_to_async
from django.conf import settings as django_settings
from django.http import HttpRequest, HttpResponseRedirect, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.api.views import _parse_body, _require_user
from apps.core.clients import tps_client
from apps.core.models import Project
from apps.core.oauth_state import decode_state, encode_state
from apps.core.services.workspace_service import current_workspace_for
from apps.tps.catalog import IntegrationSlug


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
async def list_apps(request: HttpRequest) -> JsonResponse:
    # tps_client.list_apps(category=...) filters by an int, but App.category comes back as
    # a string (a real proto mismatch) -- fetch everything and group here instead.
    apps = await tps_client.list_apps()
    grouped: dict[str, list[dict]] = {}
    for app in apps:
        grouped.setdefault(app["category"], []).append(app)
    return JsonResponse({"categories": grouped})


@csrf_exempt
async def list_connections(request: HttpRequest) -> JsonResponse:
    project_id = request.GET.get("project_id")
    if not project_id:
        return JsonResponse({"detail": "project_id is required"}, status=400)
    project = await _owned_project(request, project_id)
    if project is None:
        return JsonResponse({"detail": "Project not found"}, status=404)
    connections = await tps_client.list_connections(project_id)
    return JsonResponse({"connections": connections})


@csrf_exempt
async def install_app(request: HttpRequest, app_name: str) -> JsonResponse:
    body = _parse_body(request)
    project_id = body.get("project_id")
    if not project_id:
        return JsonResponse({"detail": "project_id is required"}, status=400)
    project = await _owned_project(request, project_id)
    if project is None:
        return JsonResponse({"detail": "Project not found"}, status=404)

    redirect_uri = body.get("redirect_uri") or f"{django_settings.APP_URL}/api/oauth/callback"
    state = encode_state(
        project_id=project_id,
        app_name=IntegrationSlug(app_name),
        callback_path="/integrations",
    )
    authorize_url = await tps_client.install_app(app_name, state, redirect_uri)
    return JsonResponse({"authorize_url": authorize_url})


@csrf_exempt
async def connect_app(request: HttpRequest, app_name: str) -> JsonResponse:
    body = _parse_body(request)
    project_id = body.get("project_id")
    if not project_id:
        return JsonResponse({"detail": "project_id is required"}, status=400)
    project = await _owned_project(request, project_id)
    if project is None:
        return JsonResponse({"detail": "Project not found"}, status=404)

    credentials = body.get("credentials") or {}
    connection = await tps_client.connect_credentials(project_id, app_name, credentials)
    return JsonResponse(connection, status=201)


@csrf_exempt
async def oauth_callback(request: HttpRequest) -> HttpResponseRedirect:
    code = request.GET.get("code")
    state = request.GET.get("state")
    if not code or not state:
        return HttpResponseRedirect(
            f"{django_settings.APP_URL}/integrations?error=missing_code_or_state"
        )
    try:
        payload = decode_state(state)
    except Exception:
        return HttpResponseRedirect(f"{django_settings.APP_URL}/integrations?error=invalid_state")

    redirect_uri = f"{django_settings.APP_URL}/api/oauth/callback"
    await tps_client.exchange_code(payload["project_id"], payload["app_name"], code, redirect_uri)
    callback_path = payload.get("callback_path", "/integrations")
    return HttpResponseRedirect(
        f"{django_settings.APP_URL}{callback_path}?connected={payload['app_name']}"
    )


@csrf_exempt
async def connection_detail(request: HttpRequest, connection_id: str) -> JsonResponse:
    if request.method != "DELETE":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    project_id = request.GET.get("project_id") or _parse_body(request).get("project_id")
    if not project_id:
        return JsonResponse({"detail": "project_id is required"}, status=400)
    project = await _owned_project(request, project_id)
    if project is None:
        return JsonResponse({"detail": "Project not found"}, status=404)

    deleted = await tps_client.delete_connection(project_id, connection_id)
    if not deleted:
        return JsonResponse({"detail": "Connection not found"}, status=404)
    return JsonResponse({"ok": True})
