"""Settings for the runner process.

Same project, its own URLconf, and no session or auth middleware: the runner is reached
only by core with a bearer token and never reads request.user. Leaving the auto-provision
middleware in would mint a throwaway User and Project for every run.
"""

from config.settings import *  # noqa: F403

ROOT_URLCONF = "config.runner_urls"

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

SILENCED_SYSTEM_CHECKS = ["admin.E408", "admin.E409", "admin.E410"]
