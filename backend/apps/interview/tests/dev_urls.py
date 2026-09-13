"""A URLconf that mounts the dev bypass unconditionally, for the tests that exercise it.

The real one mounts it only under DEBUG, and pytest-django runs with DEBUG off -- which is
correct, and means the route is genuinely absent during tests. Exercising the view
therefore needs a URLconf that asks for it, rather than the suite quietly turning DEBUG on
and testing a configuration nobody runs.
"""

from django.urls import include, path

from apps.interview.api import dev

urlpatterns = [
    path("interview/dev/sessions", dev.dev_session),
    path("", include("apps.core.api.urls")),
    path("", include("apps.interview.api.urls")),
]
