"""ASGI entrypoint for the runner process. Bound to loopback on its own port."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_runner")

application = get_asgi_application()
