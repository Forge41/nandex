"""Service authentication for the runner.

Only core presents this token. An unset secret rejects everything: the one process on
this host that can start containers must be unreachable when misconfigured, not open.
"""

import hmac

from django.http import HttpRequest

from apps.runner.config import settings


def has_service_token(request: HttpRequest) -> bool:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Bearer "):
        return False
    if not settings.service_bearer_token:
        return False
    return hmac.compare_digest(header.removeprefix("Bearer "), settings.service_bearer_token)
