"""The interview app's HTTP surface.

Plain async function views, manual method dispatch, bare JSON on success and
{"detail": ...} on failure -- the shape every app here uses. Root-mounted with no /api
prefix; frontend/next.config.ts strips that before proxying.

Nothing here reaches tps or vas directly. Every one of those calls goes through
apps.core.services.room_service, because core is the orchestrator.
"""

import json
import logging

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.api.views import _require_user
from apps.core.models import Project
from apps.core.services.workspace_service import current_workspace_for
from apps.interview import resume as resume_service
from apps.interview import services
from apps.interview.serializers import serialize_resume, serialize_session

logger = logging.getLogger(__name__)


def _parse_body(request: HttpRequest) -> dict:
    return json.loads(request.body) if request.body else {}


def _unauthorized() -> JsonResponse:
    return JsonResponse({"detail": "Authentication required"}, status=401)


def _not_found() -> JsonResponse:
    return JsonResponse({"detail": "Session not found"}, status=404)


def _default_project_sync(user) -> Project | None:
    workspace = current_workspace_for(user)
    if workspace is None:
        return None
    return Project.objects.filter(workspace=workspace).first()


async def _session_for(request: HttpRequest, session_id: str):
    """Returns (session, None) or (None, response). Scoped to the authenticated user, so
    another candidate's session is indistinguishable from one that does not exist."""
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return None, _unauthorized()
    session = await services.get_owned_session(session_id, user.id)
    if session is None:
        return None, _not_found()
    return session, None


@csrf_exempt
async def sessions(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    user = await sync_to_async(_require_user)(request)
    if user is None:
        return _unauthorized()

    body = _parse_body(request)
    role_title = body.get("roleTitle")
    if not role_title:
        return JsonResponse({"detail": "roleTitle is required"}, status=400)

    project = await sync_to_async(_default_project_sync, thread_sensitive=True)(user)
    if project is None:
        return JsonResponse({"detail": "No project for this user"}, status=409)

    session = await services.create_session(project.id, user.id, role_title)
    rounds, facts, turns = await services.load_for_serialization(session)
    return JsonResponse(serialize_session(session, rounds, facts, turns), status=201)


@csrf_exempt
async def session_detail(request: HttpRequest, session_id: str) -> JsonResponse:
    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    if request.method == "PATCH":
        try:
            session = await services.update_session(session, _parse_body(request))
        except services.InterviewError as e:
            return JsonResponse({"detail": e.detail}, status=e.status)
    elif request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    rounds, facts, turns = await services.load_for_serialization(session)
    return JsonResponse(serialize_session(session, rounds, facts, turns))


@csrf_exempt
async def session_resume(request: HttpRequest, session_id: str) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    document_id = _parse_body(request).get("documentId")
    if not document_id:
        return JsonResponse({"detail": "documentId is required"}, status=400)

    try:
        facts = await resume_service.attach_resume(session, document_id)
    except resume_service.ResumeUnreadable as e:
        return JsonResponse({"detail": str(e)}, status=400)
    except Exception:
        # A plan that could not be produced must not look like a client mistake.
        logger.warning("Couldn't plan the interview for session %s", session.id, exc_info=True)
        return JsonResponse({"detail": "Couldn't read that resume"}, status=502)

    return JsonResponse(serialize_resume(facts), status=201)


@csrf_exempt
async def session_token(request: HttpRequest, session_id: str) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    # Any identity in the body is ignored; services.mint_join_token derives it from the
    # session. Stated here because a future reader will wonder where it went.
    try:
        minted = await services.mint_join_token(session)
    except services.InterviewError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)

    return JsonResponse(minted)


@csrf_exempt
async def session_recording(request: HttpRequest, session_id: str) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    try:
        result = await services.control_recording(session, _parse_body(request).get("action", ""))
    except services.InterviewError as e:
        return JsonResponse({"detail": e.detail}, status=e.status)
    return JsonResponse(result)


@csrf_exempt
async def session_end(request: HttpRequest, session_id: str) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    session = await services.end_session(session)
    return JsonResponse({"id": session.id, "status": session.status})
