"""Settings for the vas process.

Same project, same database, its own URLconf and a leaner middleware stack. Per-process
settings rather than a per-request request.urlconf switch: the two deployables genuinely
differ in what they serve and who they authenticate.
"""

from config.settings import *  # noqa: F403

ROOT_URLCONF = "config.vas_urls"

# vas authenticates by bearer token or provider signature and never reads request.user,
# so the session/auth stack is dead weight here -- and leaving
# AutoProvisionAnonymousUserMiddleware in would mint a throwaway User, Workspace and
# Project for every cookie-less request, which for a retried webhook is unbounded write
# amplification. config.settings' exempt-prefix list is the second line of defence for
# the same endpoints served by the core process.
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

# INSTALLED_APPS is deliberately left identical to the core process, so `migrate` applies
# the same set whichever settings module it is run with -- a shared database with two
# different app lists is how a missing table happens. The cost is that django.contrib.admin
# is installed without the middleware it wants, and config.vas_urls mounts no admin route
# for it to serve.
SILENCED_SYSTEM_CHECKS = ["admin.E408", "admin.E409", "admin.E410"]

# The LiveKit server and its Egress recorder run as containers, so the Host header on
# every webhook they send is the gateway name they reach us by -- never "localhost".
# Django rejects an unlisted Host with a bare 400 from CommonMiddleware, before the view,
# which reads as "the webhook silently never arrived": the provider logs a successful send
# and nothing in the recording row ever changes. Local dev only; production sets
# DJANGO_ALLOWED_HOSTS.
if DEBUG:  # noqa: F405
    ALLOWED_HOSTS = [*ALLOWED_HOSTS, "host.docker.internal", "localhost", "127.0.0.1"]  # noqa: F405
