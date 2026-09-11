"""Service authentication for every vas endpoint except the provider webhook.

The webhook is the exception because it is authenticated by the provider's own signature
over the body -- it has no bearer token to present.
"""

import hmac

from django.http import HttpRequest

from apps.vas_recordings.config import settings


def has_service_token(request: HttpRequest) -> bool:
    header = request.META.get("HTTP_AUTHORIZATION", "")
    if not header.startswith("Bearer "):
        return False
    presented = header.removeprefix("Bearer ")
    # An unset secret must reject rather than accept everything: a misconfigured
    # deployment should be unreachable, not open.
    if not settings.service_bearer_token:
        return False
    return hmac.compare_digest(presented, settings.service_bearer_token)
