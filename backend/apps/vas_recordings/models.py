"""A video session and the recordings made of it.

VideoSession lives here rather than in an app of its own because, with token minting in
tps, it is one row with no endpoints -- the thing a recording hangs off.

Nothing in this project may reference these models: the only way in is HTTP, the same
discipline apps.tps keeps behind gRPC. The interview app stores a vas_session_id as a
plain CharField for exactly that reason.
"""

import secrets
from typing import ClassVar

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class VideoSession(models.Model):
    class Status(models.TextChoices):
        CREATED = "created", "created"
        ACTIVE = "active", "active"
        ENDED = "ended", "ended"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    # The caller's own id for whatever this session is. Unique, which is what makes
    # session registration idempotent and lazy provisioning free.
    external_session_id = models.CharField(unique=True, db_index=True, max_length=255)
    # Chosen by the caller, not derived here -- tps mints tokens against this exact name.
    room_name = models.CharField(unique=True, db_index=True, max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CREATED)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "vas_video_session"

    def __str__(self) -> str:
        return f"{self.external_session_id}:{self.status}"


class Recording(models.Model):
    class Status(models.TextChoices):
        STARTING = "starting", "starting"
        ACTIVE = "active", "active"
        ENDING = "ending", "ending"
        COMPLETE = "complete", "complete"
        FAILED = "failed", "failed"
        ABORTED = "aborted", "aborted"
        LIMIT_REACHED = "limit_reached", "limit_reached"
        DELETED = "deleted", "deleted"

    # A recording in one of these has an Egress job still running, so it can neither be
    # deleted nor replaced by a second one.
    IN_FLIGHT_STATUSES = (Status.STARTING, Status.ACTIVE, Status.ENDING)

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session = models.ForeignKey(
        VideoSession, on_delete=models.PROTECT, related_name="recordings", db_index=True
    )
    egress_id = models.CharField(unique=True, db_index=True, max_length=255)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.STARTING)
    gcs_bucket = models.CharField(max_length=255, blank=True, default="")
    gcs_object_key = models.CharField(max_length=1024, blank=True, default="")
    duration_seconds = models.FloatField(null=True, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    content_type = models.CharField(max_length=128, default="video/mp4")
    checksum = models.CharField(max_length=128, blank=True, default="")
    failure_reason = models.TextField(blank=True, default="")
    retain_until = models.DateTimeField(null=True, blank=True)
    egress_ended_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "vas_recording"
        # ClassVar only to satisfy RUF012; Django requires a plain list here.
        # The composite index serves the hot "is a recording already in flight for this
        # session" check; retain_until serves the retention sweep.
        indexes: ClassVar[list[models.Index]] = [
            models.Index(fields=["session", "status"]),
            models.Index(fields=["retain_until"]),
        ]

    def __str__(self) -> str:
        return f"{self.egress_id}:{self.status}"
