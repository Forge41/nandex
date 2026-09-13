"""URLs served by the runner process only.

Nothing else is mounted: core's endpoints are not reachable from the process that holds
the Docker socket, and this one is not reachable from core's.
"""

from django.http import JsonResponse
from django.urls import include, path


def health(request):
    return JsonResponse({"status": "ok", "service": "runner"})


urlpatterns = [
    path("health", health),
    path("", include("apps.runner.api.urls")),
]
