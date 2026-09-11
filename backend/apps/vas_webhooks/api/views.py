"""The provider's event receiver.

No bearer token: this endpoint is authenticated by the provider's own signature over the
request body, which is why request.body is read and verified before anything is parsed.
"""

import logging

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.vas_webhooks import services

logger = logging.getLogger(__name__)


@csrf_exempt
async def livekit(request: HttpRequest) -> JsonResponse:
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        await services.handle_event(request.body, request.META.get("HTTP_AUTHORIZATION", ""))
    except ValueError:
        # Identical response for every validation failure, so a caller can't use the
        # error to distinguish a bad signature from a stale timestamp.
        logger.warning("Rejected a LiveKit webhook", exc_info=True)
        return JsonResponse({"detail": "Invalid webhook signature"}, status=401)

    return JsonResponse({"received": True})
