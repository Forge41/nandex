"""Handler registry — one entry per connector, keyed by app_name."""

from apps.tps.catalog import IntegrationSlug
from apps.tps.handlers.base import CredentialHandler, OAuthHandler
from apps.tps.handlers.google_drive import GoogleDriveHandler

HANDLER_REGISTRY: dict[IntegrationSlug, type] = {
    IntegrationSlug.GOOGLE_DRIVE: GoogleDriveHandler,
}


def get_handler(app_name: IntegrationSlug) -> OAuthHandler | CredentialHandler:
    handler_cls = HANDLER_REGISTRY.get(app_name)
    if not handler_cls:
        raise ValueError(f"No handler for app: {app_name}")
    return handler_cls()


def get_oauth_handler(app_name: IntegrationSlug) -> OAuthHandler:
    handler = get_handler(app_name)
    if not isinstance(handler, OAuthHandler):
        raise ValueError(f"App '{app_name}' does not support the OAuth flow")
    return handler


def get_credential_handler(app_name: IntegrationSlug) -> CredentialHandler:
    handler = get_handler(app_name)
    if not isinstance(handler, CredentialHandler):
        raise ValueError(f"App '{app_name}' does not support the credential flow")
    return handler
