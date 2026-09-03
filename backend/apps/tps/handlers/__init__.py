"""Handler registry — one entry per connector, keyed by app_name.

Empty until a connector actually ships: add an entry (and a matching handler module,
plus a catalog-seed migration) per provider as they're built.
"""

from apps.tps.handlers.base import CredentialHandler, OAuthHandler

HANDLER_REGISTRY: dict[str, type] = {}


def get_handler(app_name: str) -> OAuthHandler | CredentialHandler:
    handler_cls = HANDLER_REGISTRY.get(app_name)
    if not handler_cls:
        raise ValueError(f"No handler for app: {app_name}")
    return handler_cls()


def get_oauth_handler(app_name: str) -> OAuthHandler:
    handler = get_handler(app_name)
    if not isinstance(handler, OAuthHandler):
        raise ValueError(f"App '{app_name}' does not support the OAuth flow")
    return handler


def get_credential_handler(app_name: str) -> CredentialHandler:
    handler = get_handler(app_name)
    if not isinstance(handler, CredentialHandler):
        raise ValueError(f"App '{app_name}' does not support the credential flow")
    return handler
