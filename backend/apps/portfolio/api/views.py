"""Anonymous by design: these never read request.user, and /portfolio/ is exempt from
visitor auto-provisioning (settings.ANONYMOUS_AUTOPROVISION_EXEMPT_PREFIXES).

Every refusal of ask/fit carries `fallback: true`, telling the page to answer from its
offline matcher instead of showing an error."""

import hmac
import json
import logging

from asgiref.sync import sync_to_async
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import EmailMessage
from django.core.validators import validate_email
from django.http import HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from apps.core.services.room_service import RoomUnavailable
from apps.portfolio import limits, service, voice
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
    # Sent from our own domain (DEFAULT_FROM_EMAIL), since mail claiming to be from the
    # visitor's address would fail their domain's SPF/DMARC. Reply-To makes answering
    # them one click.
    EmailMessage(
        subject=f"Portfolio message from {contact.name or contact.email}",
        body=f"From: {contact.name} <{contact.email}>\n\n{contact.text}",
        to=[settings.owner_email],
        reply_to=[contact.email],
    ).send()
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


@csrf_exempt
@require_POST
async def voice_token(request: HttpRequest) -> JsonResponse:
    if not settings.voice_enabled:
        return _refuse("Voice isn't available right now.", 503)
    reason = limits.voice_limit_reason(request)
    if reason:
        return _refuse(reason, 429)
    if await limits.daily_cap_reached():
        return _refuse("Live answers are paused for today.", 503)
    try:
        minted = await voice.mint_visitor_token()
    except RoomUnavailable:
        return _refuse("Voice isn't available right now.", 503)
    return JsonResponse(minted, status=201)


def _has_agent_token(request: HttpRequest) -> bool:
    header = request.headers.get("Authorization", "")
    # An unset secret rejects everything rather than accepting everything.
    if not settings.agent_bearer_token or not header.startswith("Bearer "):
        return False
    return hmac.compare_digest(header.removeprefix("Bearer "), settings.agent_bearer_token)


@csrf_exempt
@require_POST
async def agent_passages(request: HttpRequest) -> JsonResponse:
    """Retrieval for the voice agent, which composes the spoken answer itself. Behind the
    agent's bearer token rather than visitor limits: the room token was the rate-limited
    step, and the agent ends the room at voice_max_minutes."""
    if not _has_agent_token(request):
        return JsonResponse({"detail": "Not authorised"}, status=401)
    question = _body(request).get("question")
    question = question.strip()[: settings.max_question_chars] if isinstance(question, str) else ""
    if not question:
        return JsonResponse({"detail": "Nothing to look up."}, status=400)

    passages = await service.retrieve(question)
    await PortfolioQuery.objects.acreate(
        kind=PortfolioQuery.Kind.VOICE,
        text=question,
        retrieved=list(dict.fromkeys(p.source.id for p in passages)),
        outcome=PortfolioQuery.Outcome.ANSWERED,
    )
    return JsonResponse(
        {
            "passages": [
                {
                    "id": p.source.id,
                    "doc": p.source.doc,
                    "title": p.source.title,
                    "content": p.content,
                }
                for p in passages
            ]
        }
    )


# One email per key and problem in this window. The cache is per process, so a burst
# across several core workers can still send one each.
SPEECH_ALERT_WINDOW_SECONDS = 6 * 3600


def _email_speech_alert_sync(key: str, problem: str, layers_left: int) -> bool:
    if not settings.owner_email:
        return False
    if not cache.add(f"portfolio:speech-alert:{key}:{problem}", 1, SPEECH_ALERT_WINDOW_SECONDS):
        return False
    if layers_left:
        headline = f"Cartesia key {key} is {problem}; {layers_left} fallback key(s) left"
        action = "Replace it in /opt/nandex/.env and recreate the agent container before the rest run out."
    else:
        headline = f"Cartesia key {key} is {problem}; no speech keys left, voice is text only"
        action = "Add a working key to /opt/nandex/.env (CARTESIA_API_KEY … CARTESIA_API_KEY_5) and recreate the agent container."
    EmailMessage(
        subject=f"[portfolio] {headline}",
        body=f"{headline}.\n\n{action}\n",
        to=[settings.owner_email],
    ).send()
    return True


@csrf_exempt
@require_POST
async def agent_speech_key_alert(request: HttpRequest) -> JsonResponse:
    """The voice agent found a Cartesia key it can't speak with. It sends a hint, never
    the key itself."""
    if not _has_agent_token(request):
        return JsonResponse({"detail": "Not authorised"}, status=401)
    body = _body(request)
    key, problem, left = body.get("key"), body.get("problem"), body.get("layers_left")
    if not (
        isinstance(key, str)
        and key
        and isinstance(problem, str)
        and problem
        and isinstance(left, int)
    ):
        return JsonResponse({"detail": "key, problem and layers_left are required."}, status=400)
    key, problem = key[:80], problem[:80]
    logger.warning("Speech key %s is %s; %d left", key, problem, left)
    try:
        sent = await sync_to_async(_email_speech_alert_sync, thread_sensitive=True)(
            key, problem, max(0, left)
        )
    except Exception:
        logger.exception("Couldn't email the speech key alert for %s", key)
        sent = False
    return JsonResponse({"emailed": sent})
