"""URLs served by the vas process only.

Mounting nothing else is the point: the core app's endpoints are not reachable here, and
vas's are not reachable from the core process.
"""

from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok", "service": "vas"})


urlpatterns = [
    path("health", health),
    path("", include("apps.vas_recordings.api.urls")),
    path("", include("apps.vas_webhooks.api.urls")),
    path("", include("apps.vas_compliance.api.urls")),
]
