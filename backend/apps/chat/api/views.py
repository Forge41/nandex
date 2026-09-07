import json

from asgiref.sync import sync_to_async
from django.http import HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt

from apps.chat.models import Conversation, Message
from apps.chat.service import ask
from apps.core.api.views import _parse_body, _require_user


def _serialize_conversation(conversation: Conversation) -> dict:
    return {
        "id": conversation.id,
        "project_id": conversation.project_id,
        "title": conversation.title,
        "created_at": conversation.created_at.isoformat(),
        "updated_at": conversation.updated_at.isoformat(),
    }


def _serialize_message(message: Message) -> dict:
    return {
        "id": message.id,
        "role": message.role,
        "content": message.content,
        "citations": message.citations,
        "created_at": message.created_at.isoformat(),
    }


async def _get_owned_conversation(user, conversation_id: str) -> Conversation | None:
    try:
        return await Conversation.objects.aget(id=conversation_id, user_id=user.id)
    except Conversation.DoesNotExist:
        return None


@csrf_exempt
async def conversations(request: HttpRequest) -> JsonResponse:
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    if request.method == "POST":
        body = _parse_body(request)
        project_id = body.get("project_id")
        if not project_id:
            return JsonResponse({"detail": "project_id is required"}, status=400)
        conversation = await Conversation.objects.acreate(project_id=project_id, user_id=user.id)
        return JsonResponse(_serialize_conversation(conversation), status=201)

    project_id = request.GET.get("project_id")
    qs = Conversation.objects.filter(user_id=user.id).order_by("-updated_at")
    if project_id:
        qs = qs.filter(project_id=project_id)
    result = [_serialize_conversation(c) async for c in qs]
    return JsonResponse(result, safe=False)


@csrf_exempt
async def conversation_detail(request: HttpRequest, conversation_id: str) -> JsonResponse:
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    conversation = await _get_owned_conversation(user, conversation_id)
    if conversation is None:
        return JsonResponse({"detail": "Conversation not found"}, status=404)

    messages = [
        _serialize_message(m)
        async for m in Message.objects.filter(conversation=conversation).order_by("created_at")
    ]
    return JsonResponse({**_serialize_conversation(conversation), "messages": messages})


@csrf_exempt
async def post_message(request: HttpRequest, conversation_id: str) -> HttpResponse:
    user = await sync_to_async(_require_user)(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    conversation = await _get_owned_conversation(user, conversation_id)
    if conversation is None:
        return JsonResponse({"detail": "Conversation not found"}, status=404)

    question = json.loads(request.body).get("message") if request.body else None
    if not question:
        return JsonResponse({"detail": "message is required"}, status=400)

    response = StreamingHttpResponse(
        ask(conversation=conversation, question=question), content_type="text/event-stream"
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"  # matters if this ever sits behind nginx
    return response
