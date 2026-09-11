"""Receive, de-duplicate and dispatch one provider event."""

import logging

from asgiref.sync import sync_to_async

from apps.vas_recordings.providers import get_webhook_validator
from apps.vas_webhooks.models import WebhookLog
from apps.vas_webhooks.registry import registry

logger = logging.getLogger(__name__)


def _log_event_sync(event) -> tuple[WebhookLog, bool]:
    return WebhookLog.objects.get_or_create(
        event_id=event.event_id,
        defaults={
            "event_type": event.event_type,
            "room_name": event.room_name,
            "egress_id": event.egress_id,
            "raw_payload": event.raw_payload,
        },
    )


async def handle_event(raw_body: bytes, auth_header: str) -> None:
    """Raises ValueError when the signature doesn't verify. The signature is checked
    against the exact bytes received before anything is parsed or written."""
    event = get_webhook_validator().validate_and_parse(raw_body, auth_header)

    log, created = await sync_to_async(_log_event_sync)(event)
    if not created:
        logger.info("Ignoring duplicate webhook %s", event.event_id)
        return

    try:
        await registry.dispatch(event)
    except Exception as e:
        await WebhookLog.objects.filter(id=log.id).aupdate(processing_error=str(e))
        logger.exception("Webhook %s (%s) failed", event.event_id, event.event_type)
        raise

    await WebhookLog.objects.filter(id=log.id).aupdate(processed=True)
