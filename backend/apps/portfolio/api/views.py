"""Anonymous by design: these never read request.user, and /portfolio/ is exempt from
visitor auto-provisioning (settings.ANONYMOUS_AUTOPROVISION_EXEMPT_PREFIXES).

Every refusal of ask/fit carries `fallback: true`, telling the page to answer from its
offline matcher instead of showing an error."""

import json
import logging

from asgiref.sync import sync_to_async
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.http import HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from apps.portfolio import limits, service
from apps.portfolio.config import settings
from apps.portfolio.models import ContactMessage, PortfolioQuery

logger = logging.getLogger(__name__)


def _body(request: HttpRequest) -> dict:
    try:
        body = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return {}
    return body if isinstance(body, dict) else {}


def _refuse(detail: str, status: int) -> JsonResponse:
    return JsonResponse({"detail": detail, "fallback": True}, status=status)


async def _answer(request: HttpRequest, kind: str, text: str, max_chars: int) -> HttpResponse:
    text = text.strip() if isinstance(text, str) else ""
    if not text:
        return JsonResponse({"detail": "Nothing to answer."}, status=400)
    if len(text) > max_chars:
        return JsonResponse({"detail": f"Keep it under {max_chars} characters."}, status=400)

    reason = limits.question_limit_reason(request)
    if reason:
        return _refuse(reason, 429)
    if await limits.daily_cap_reached():
        return _refuse("Live answers are paused for today.", 503)

    passages = await service.retrieve(text)
    if not passages:
        return _refuse("Nothing is indexed to answer from yet.", 503)

    response = StreamingHttpResponse(
        service.stream(kind, text, passages), content_type="text/event-stream"
    )
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


@csrf_exempt
@require_POST
async def ask(request: HttpRequest) -> HttpResponse:
    return await _answer(
        request,
        PortfolioQuery.Kind.ASK,
        _body(request).get("question"),
        settings.max_question_chars,
    )


@csrf_exempt
@require_POST
async def fit(request: HttpRequest) -> HttpResponse:
    return await _answer(
        request, PortfolioQuery.Kind.FIT, _body(request).get("jd"), settings.max_jd_chars
    )


def _notify_owner_sync(contact: ContactMessage) -> None:
    if not settings.owner_email:
        return
    send_mail(
        subject=f"Portfolio message from {contact.name or contact.email}",
        message=f"From: {contact.name} <{contact.email}>\n\n{contact.text}",
        from_email=None,
        recipient_list=[settings.owner_email],
    )
    ContactMessage.objects.filter(id=contact.id).update(notified=True)


@csrf_exempt
@require_POST
async def message(request: HttpRequest) -> JsonResponse:
    body = _body(request)
    name = str(body.get("name") or "").strip()[:200]
    email = str(body.get("email") or "").strip()
    text = str(body.get("text") or "").strip()
    if not email or not text:
        return JsonResponse({"detail": "Email and text are required."}, status=400)
    try:
        validate_email(email)
    except ValidationError:
        return JsonResponse({"detail": "That email address doesn't look right."}, status=400)
    if len(text) > 5000:
        return JsonResponse({"detail": "Keep it under 5000 characters."}, status=400)

    reason = limits.message_limit_reason(request)
    if reason:
        return JsonResponse({"detail": reason}, status=429)

    # Saved before emailing: the row is the record, the email only a notification, so a
    # mail outage never loses a message.
    contact = await ContactMessage.objects.acreate(name=name, email=email, text=text)
    try:
        await sync_to_async(_notify_owner_sync, thread_sensitive=True)(contact)
    except Exception:
        logger.exception("Stored contact message %s but could not email it", contact.id)
    return JsonResponse({"ok": True}, status=201)
