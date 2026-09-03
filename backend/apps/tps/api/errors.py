"""Translates tps's internal exceptions into JSON error responses.

Views raise TpsError (auth/header problems) or ValueError (bad request — unknown app,
wrong auth flow, invalid credentials); this decorator is where those become HTTP responses,
mirroring how the reference's FastAPI dependencies raised HTTPException directly.
"""

import functools
import json
import logging

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.tps.deps import TpsError

logger = logging.getLogger(__name__)


def tps_view(view):
    """Every tps endpoint is machine-to-machine, authenticated by X-TPS-Secret rather
    than a session cookie, so Django's cookie-based CSRF protection doesn't apply here —
    csrf_exempt is applied once, in this shared decorator, instead of on every view."""

    @csrf_exempt
    @functools.wraps(view)
    async def wrapped(request: HttpRequest, *args, **kwargs):
        try:
            return await view(request, *args, **kwargs)
        except TpsError as e:
            return JsonResponse({"detail": e.detail}, status=e.status)
        except ValueError as e:
            return JsonResponse({"detail": str(e)}, status=400)
        except Exception:
            logger.exception("Unhandled error in %s", view.__name__)
            return JsonResponse({"detail": "Internal server error"}, status=500)

    return wrapped


def parse_json_body(request: HttpRequest) -> dict:
    if not request.body:
        return {}
    try:
        return json.loads(request.body)
    except json.JSONDecodeError:
        raise ValueError("Request body must be valid JSON") from None
