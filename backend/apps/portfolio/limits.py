"""Best-effort per-visitor limits in the cache, plus a hard daily cap read from the query
log. The cache is per process, so the per-IP numbers hold per worker; the daily cap is
counted in the database and holds across all of them."""

import hashlib
from datetime import timedelta

from django.conf import settings as django_settings
from django.core.cache import cache
from django.http import HttpRequest
from django.utils import timezone

from apps.portfolio.config import settings
from apps.portfolio.models import PortfolioQuery


def client_key(request: HttpRequest) -> str:
    # Leftmost X-Forwarded-For is the visitor as Netlify saw them. Spoofable, which is why
    # the database-counted daily cap, not this, is the real ceiling.
    forwarded = request.headers.get("X-Forwarded-For", "")
    ip = forwarded.split(",")[0].strip() or request.META.get("REMOTE_ADDR", "")
    return hashlib.sha256(f"{django_settings.SECRET_KEY}:{ip}".encode()).hexdigest()[:32]


def _hit(key: str, limit: int, window: timedelta) -> bool:
    """Counts one hit; True when it goes over the limit."""
    if cache.add(key, 1, timeout=int(window.total_seconds())):
        return limit < 1
    try:
        return cache.incr(key) > limit
    except ValueError:
        cache.add(key, 1, timeout=int(window.total_seconds()))
        return False


def question_limit_reason(request: HttpRequest) -> str | None:
    key = client_key(request)
    if _hit(f"portfolio:q:m:{key}", settings.per_ip_per_minute, timedelta(minutes=1)):
        return "Too many questions in a minute. Give it a moment."
    if _hit(f"portfolio:q:d:{key}", settings.per_ip_per_day, timedelta(days=1)):
        return "That's today's limit for live answers."
    return None


def message_limit_reason(request: HttpRequest) -> str | None:
    key = client_key(request)
    if _hit(f"portfolio:m:h:{key}", settings.messages_per_ip_per_hour, timedelta(hours=1)):
        return "Too many messages. Try again in an hour, or email directly."
    return None


async def daily_cap_reached() -> bool:
    since = timezone.now() - timedelta(days=1)
    return await PortfolioQuery.objects.filter(created_at__gte=since).acount() >= (
        settings.daily_request_cap
    )
