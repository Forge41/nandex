"""A log of every provider event received, and whether we managed to process it.

The unique event_id is the idempotency mechanism: providers retry, so a duplicate must
be recognised before any handler runs.
"""

import secrets

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class WebhookLog(models.Model):
    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    event_id = models.CharField(unique=True, db_index=True, max_length=255)
    event_type = models.CharField(db_index=True, max_length=128)
    room_name = models.CharField(max_length=255, blank=True, default="")
    egress_id = models.CharField(db_index=True, max_length=255, blank=True, default="")
    raw_payload = models.JSONField(default=dict)
    processed = models.BooleanField(default=False, db_index=True)
    processing_error = models.TextField(blank=True, default="")
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vas_webhook_log"

    def __str__(self) -> str:
        return f"{self.event_type}:{self.event_id}"
