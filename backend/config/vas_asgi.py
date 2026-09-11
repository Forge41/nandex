"""ASGI entrypoint for the vas process. Served on a different port from config.asgi."""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings_vas")

application = get_asgi_application()
