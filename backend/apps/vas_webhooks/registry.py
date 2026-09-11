"""event_type -> handlers. Populated from VasWebhooksConfig.ready(), never at import."""

import logging
from collections.abc import Awaitable, Callable

from apps.vas_recordings.providers.base import ProviderEvent

logger = logging.getLogger(__name__)

Handler = Callable[[ProviderEvent], Awaitable[None]]


class WebhookRegistry:
    def __init__(self) -> None:
        self._handlers: dict[str, list[Handler]] = {}

    def register(self, event_type: str, handler: Handler) -> None:
        self._handlers.setdefault(event_type, []).append(handler)

    def clear(self) -> None:
        self._handlers.clear()

    async def dispatch(self, event: ProviderEvent) -> None:
        handlers = self._handlers.get(event.event_type, [])
        if not handlers:
            logger.warning(
                "No handler for webhook event_type=%s event_id=%s",
                event.event_type,
                event.event_id,
            )
            return
        for handler in handlers:
            await handler(event)


registry = WebhookRegistry()
