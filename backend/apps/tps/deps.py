"""Shared request-level checks for tps views.

FastAPI's Depends() has no direct Django equivalent, so these are plain functions that
raise TpsError on failure; views call them at the top of the handler and let TpsError
propagate to the @tps_view decorator (see api/errors.py) for translation to a response.
"""

from django.http import HttpRequest

from apps.tps.config import settings


class TpsError(Exception):
    def __init__(self, status: int, detail: str):
        self.status = status
        self.detail = detail
        super().__init__(detail)


def require_tps_secret(request: HttpRequest) -> None:
    """Validate the shared secret header from another internal service."""
    if request.headers.get("X-TPS-Secret") != settings.tps_secret:
        raise TpsError(403, "Invalid TPS secret")


def require_user_id(request: HttpRequest) -> str:
    """Extract user_id from the request header."""
    user_id = request.headers.get("X-User-ID")
    if not user_id:
        raise TpsError(400, "X-User-ID header required")
    return user_id
