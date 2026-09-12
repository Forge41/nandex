"""Service authentication for the endpoints the interviewer agent uses.

The agent runs as its own process with no candidate cookie, so it presents a shared
bearer token instead -- the same shape core already uses to reach vas. Every other
interview endpoint stays cookie-authenticated and session-scoped; these two are the only
way in from outside the browser, and they are read-one-session and append-transcript.
"""

import hmac

from django.http import HttpRequest

from apps.interview.config import settings


def has_agent_token(request: HttpRequest) -> bool:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Bearer "):
        return False
    # An unset secret must reject rather than accept everything: a misconfigured
    # deployment should be unreachable, not open.
    if not settings.agent_bearer_token:
        return False
    return hmac.compare_digest(header.removeprefix("Bearer "), settings.agent_bearer_token)
