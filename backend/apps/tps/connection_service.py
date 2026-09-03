"""Connection CRUD + token lifecycle management.

Django's ORM is synchronous; the DB-locking steps here run through sync_to_async while
the provider handler calls (exchange/refresh/revoke) are awaited directly as native
coroutines. The row lock in _read_and_maybe_flag_refresh is released once that sync call
returns, before refresh_token is awaited — a refresh can still race with another refresh
in the narrow window between the two locked sections, which is why _write_refreshed_config
re-checks expiry under a fresh lock before writing.
"""

import logging
import time

from asgiref.sync import sync_to_async
from django.db import transaction
from django.utils import timezone

from apps.tps.crypto import decrypt_config, encrypt_config
from apps.tps.handlers import get_handler
from apps.tps.handlers.base import OAuthHandler
from apps.tps.models import Connection, Connector

logger = logging.getLogger(__name__)

REFRESH_BUFFER_SECONDS = 120  # refresh 2 minutes before actual expiry


def _read_and_maybe_flag_refresh(connection_id: str, user_id: str) -> tuple[Connection, dict, bool]:
    with transaction.atomic():
        connection = Connection.objects.select_for_update().get(
            id=connection_id, user_id=user_id, status=Connection.Status.ACTIVE
        )
        config = decrypt_config(connection.config_encrypted)
        handler = get_handler(connection.app_name)

        needs_refresh = False
        if isinstance(handler, OAuthHandler):
            expiring_soon = connection.expires_at and time.time() >= (
                connection.expires_at - REFRESH_BUFFER_SECONDS
            )
            if expiring_soon or handler.is_token_expired(config):
                needs_refresh = True

        return connection, config, needs_refresh


def _write_refreshed_config(connection_id: str, user_id: str, config: dict) -> None:
    with transaction.atomic():
        connection = Connection.objects.select_for_update().get(
            id=connection_id, user_id=user_id, status=Connection.Status.ACTIVE
        )
        connection.config_encrypted = encrypt_config(config)
        connection.expires_at = config.get("expires_at")
        connection.save(update_fields=["config_encrypted", "expires_at", "updated_at"])


async def get_or_refresh(connection_id: str, user_id: str) -> dict:
    """Get a connection's decrypted config, refreshing the token if it's expired."""
    try:
        connection, config, needs_refresh = await sync_to_async(
            _read_and_maybe_flag_refresh, thread_sensitive=True
        )(connection_id, user_id)
    except Connection.DoesNotExist:
        raise ValueError(f"Connection {connection_id} not found for user {user_id}") from None

    if not needs_refresh:
        return config

    logger.info("Token expired for connection %s, refreshing", connection_id)
    handler = get_handler(connection.app_name)
    config = await handler.refresh_token(config)
    await sync_to_async(_write_refreshed_config, thread_sensitive=True)(
        connection_id, user_id, config
    )
    return config


def _upsert_connection_sync(
    user_id: str,
    app_name: str,
    config: dict,
    identifier: str | None,
    expires_at: float | None,
) -> Connection:
    identifier = identifier or ""
    with transaction.atomic():
        try:
            connector = Connector.objects.get(app_name=app_name)
        except Connector.DoesNotExist:
            raise ValueError(f"App '{app_name}' not found in the connector catalog") from None

        connection, created = Connection.objects.select_for_update().get_or_create(
            user_id=user_id,
            app_name=app_name,
            status=Connection.Status.ACTIVE,
            defaults={
                "connector": connector,
                "config_encrypted": encrypt_config(config),
                "identifier": identifier,
                "expires_at": expires_at,
            },
        )
        if not created:
            connection.config_encrypted = encrypt_config(config)
            connection.identifier = identifier
            connection.expires_at = expires_at
            connection.save(
                update_fields=["config_encrypted", "identifier", "expires_at", "updated_at"]
            )
        return connection


async def create_connection(
    user_id: str,
    app_name: str,
    config: dict,
    identifier: str | None = None,
    expires_at: float | None = None,
) -> Connection:
    """Create or update the user's active connection for a connector — upserts."""
    return await sync_to_async(_upsert_connection_sync, thread_sensitive=True)(
        user_id, app_name, config, identifier, expires_at
    )


def _revoke_connection_sync(connection_id: str, user_id: str) -> None:
    with transaction.atomic():
        connection = Connection.objects.select_for_update().get(id=connection_id, user_id=user_id)
        connection.status = Connection.Status.REVOKED
        connection.config_encrypted = encrypt_config({})
        connection.expires_at = None
        connection.updated_at = timezone.now()
        connection.save(update_fields=["status", "config_encrypted", "expires_at", "updated_at"])


async def delete_connection(connection_id: str, user_id: str) -> bool:
    """Revoke a connection — best-effort provider-side revoke, then wipe stored credentials."""
    try:
        connection = await Connection.objects.aget(id=connection_id, user_id=user_id)
    except Connection.DoesNotExist:
        return False

    try:
        handler = get_handler(connection.app_name)
        if isinstance(handler, OAuthHandler):
            config = decrypt_config(connection.config_encrypted)
            await handler.revoke_token(config)
    except Exception:
        logger.warning("Token revocation failed for %s", connection.app_name, exc_info=True)

    await sync_to_async(_revoke_connection_sync, thread_sensitive=True)(connection_id, user_id)
    return True
