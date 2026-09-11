from django.apps import AppConfig


class VasWebhooksConfig(AppConfig):
    name = "apps.vas_webhooks"
    label = "vas_webhooks"

    def ready(self) -> None:
        # Registration happens here rather than at module import so the handlers can
        # reach the ORM; importing them at module scope runs before the app registry is
        # populated.
        from apps.vas_webhooks import handlers

        handlers.register_default_handlers()
