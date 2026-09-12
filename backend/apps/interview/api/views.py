"""The interview app's HTTP surface.

Plain async function views, manual method dispatch, bare JSON on success and
{"detail": ...} on failure -- the shape every app here uses. Root-mounted with no /api
prefix; frontend/next.config.ts strips that before proxying.

Nothing here reaches tps or vas directly. Every one of those calls goes through
apps.core.services.room_service, because core is the orchestrator.
"""

import io
import json
import logging

from asgiref.sync import sync_to_async
from django.http import FileResponse, HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.api.views import _require_user
from apps.core.models import Project
from apps.core.services.workspace_service import current_workspace_for
from apps.importer.models import RawDocument
from apps.importer.uploads import UploadRejected, create_uploaded_document
from apps.interview import services, workflow_client
from apps.interview.models import InterviewSession
from apps.interview.serializers import serialize_session

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


async def _serialized(session) -> dict:
    rounds, facts, turns = await services.load_for_serialization(session)
    return serialize_session(session, rounds, facts, turns)


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
    return JsonResponse(await _serialized(session), status=201)


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

    return JsonResponse(await _serialized(session))


@csrf_exempt
async def session_resume(request: HttpRequest, session_id: str) -> JsonResponse:
    """Accepts the file itself, and answers before the plan exists.

    202, not 201: reading a resume and planning an interview from it is two model-scale
    steps, and holding a request open for them is exactly what this app's workflow rule
    forbids. The caller watches /plan for the rest.

    The project comes from the session rather than the body -- the browser has no
    business knowing project ids, and one it sent would have to be checked anyway.
    """
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    upload = request.FILES.get("file")
    if upload is not None:
        try:
            document = await create_uploaded_document(
                project_id=session.project_id, upload=upload, trigger_ingest=False
            )
        except UploadRejected as e:
            return JsonResponse({"detail": str(e)}, status=400)
        document_id = document.id
    elif request.content_type == "application/json":
        # Reading request.FILES has already consumed the stream, so request.body is only
        # reachable when this was never a multipart request in the first place.
        document_id = _parse_body(request).get("documentId")
        if not document_id:
            return JsonResponse({"detail": "A resume file is required"}, status=400)
    else:
        return JsonResponse({"detail": "A resume file is required"}, status=400)

    session.plan_state = InterviewSession.PlanState.PROCESSING
    session.plan_error = ""
    session.resume_document_id = document_id
    await session.asave(
        update_fields=["plan_state", "plan_error", "resume_document_id", "updated_at"]
    )

    if not await workflow_client.start_plan(session.id, document_id):
        session.plan_state = InterviewSession.PlanState.FAILED
        session.plan_error = "We couldn't start reading your resume. Try again."
        await session.asave(update_fields=["plan_state", "plan_error", "updated_at"])
        return JsonResponse({"detail": session.plan_error}, status=502)

    return JsonResponse(await _serialized(session), status=202)


async def session_plan(request: HttpRequest, session_id: str) -> JsonResponse:
    """What is being done to the resume, step by step.

    The steps are the workflow's own account of itself, so they describe this resume --
    its page count, the rounds its plan actually named. When the workflow cannot be
    reached the session row still knows whether the plan is ready, which is the part a
    page load cannot do without.
    """
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    live = await workflow_client.plan_progress(session.id)
    if live is not None and live.get("status") == session.plan_state:
        return JsonResponse(live)

    # Either no workflow to ask, or it has moved on since the row was written. The row is
    # the durable answer; the steps are detail, and detail is allowed to be missing.
    return JsonResponse(
        {
            "status": session.plan_state,
            "error": session.plan_error,
            "steps": (live or {}).get("steps", []),
        }
    )


async def session_resume_file(request: HttpRequest, session_id: str):
    """The candidate's own document, as they uploaded it.

    Served rather than linked: the object URL the browser made at the dropzone dies at
    the first navigation, and the plan screen offers to open the source document.
    """
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    session, error = await _session_for(request, session_id)
    if error is not None:
        return error

    document = await RawDocument.objects.filter(
        id=session.resume_document_id, project_id=session.project_id
    ).afirst()
    if document is None:
        return JsonResponse({"detail": "No resume on this session"}, status=404)

    response = FileResponse(
        io.BytesIO(bytes(document.payload)),
        content_type=document.content_type or "application/octet-stream",
        # Inline: this opens in a viewer tab, it is not a download.
        as_attachment=False,
        filename=document.display_name or "resume",
    )
    return response


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
