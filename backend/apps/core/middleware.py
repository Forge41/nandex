"""Auto-provisions an anonymous, persistent identity for any request with no logged-in
user -- there is no login requirement in this app; a visitor's session cookie alone is
what makes them "the same person" on a return visit. See apps.core.auth.service for the
shared workspace/project bootstrap this reuses from the (still-available, just unused by
the frontend) magic-link flow.
"""

from django.conf import settings

from apps.core.auth.service import ensure_workspace_and_project, log_in_as
from apps.core.models import User, generate_id


class AutoProvisionAnonymousUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        exempt = getattr(settings, "ANONYMOUS_AUTOPROVISION_EXEMPT_PREFIXES", ())
        if not request.path.startswith(exempt) and not request.user.is_authenticated:
            user = User.objects.create(email=f"anon-{generate_id()}@anon.local")
            ensure_workspace_and_project(user)
            log_in_as(request, user)
        return self.get_response(request)
