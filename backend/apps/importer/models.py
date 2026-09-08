"""importer models — SyncRun tracks one sync attempt per Connection; RawDocument is the
immutable output; SyncItemFailure is the per-item dead-letter ledger.

connection_id/sync_run FKs to tps stay plain ids, not Django ForeignKeys — cross-app
references stay plain ids throughout this codebase so apps don't import each other's
models directly (see apps.tps.Connection.project_id for the same convention).
"""

import secrets

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class SyncRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "running"
        COMPLETED = "completed", "completed"
        ERRORED = "errored", "errored"
        CANCELLED = "cancelled", "cancelled"
        QUOTA_EXCEEDED = "quota_exceeded", "quota_exceeded"

    class Trigger(models.TextChoices):
        MANUAL = "manual", "manual"
        WEBHOOK = "webhook", "webhook"
        SCHEDULED = "scheduled", "scheduled"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    connection_id = models.CharField(db_index=True, max_length=24)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    trigger = models.CharField(max_length=16, choices=Trigger.choices, default=Trigger.MANUAL)
    cursor = models.TextField(blank=True, default="")  # opaque, provider-defined
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    items_written = models.PositiveIntegerField(default=0)
    items_failed = models.PositiveIntegerField(default=0)
    bytes_written = models.PositiveBigIntegerField(default=0)

    class Meta:
        db_table = "importer_sync_run"

    def __str__(self) -> str:
        return f"{self.connection_id}:{self.id}"


class RawDocument(models.Model):
    """Immutable — written once by a SyncWorkflow, never mutated except by an upsert
    keyed on the same uniqueness tuple (a retried write of the same version, not a
    change)."""

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    connection_id = models.CharField(db_index=True, max_length=24)
    # Set only for a document uploaded directly (connection_id="upload") rather than synced
    # from a connected app -- there's no Connection row to resolve a project through for
    # those, so apps.chat.scoping matches on this directly. Blank for every connector-synced
    # row, which keeps resolving visibility through connection_id as before.
    project_id = models.CharField(db_index=True, max_length=24, blank=True, default="")
    provider_document_id = models.CharField(db_index=True, max_length=256)
    provider_version = models.CharField(blank=True, default="", max_length=256)
    # Human-readable filename -- the uploaded file's own name, or the provider's ItemRef.name
    # for a connector sync. Blank for any row written before this field existed.
    display_name = models.CharField(blank=True, default="", max_length=512)
    payload = models.BinaryField()
    content_type = models.CharField(blank=True, default="", max_length=128)
    fetched_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "importer_raw_document"
        constraints = (
            models.UniqueConstraint(
                fields=["connection_id", "provider_document_id", "provider_version"],
                name="uniq_raw_document_version",
            ),
        )

    def __str__(self) -> str:
        return f"{self.connection_id}:{self.provider_document_id}"


class SyncItemFailure(models.Model):
    class FailureType(models.TextChoices):
        TRANSIENT_EXHAUSTED = "transient_exhausted", "transient_exhausted"
        PERMANENT = "permanent", "permanent"
        AUTH_EXPIRED = "auth_expired", "auth_expired"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    sync_run = models.ForeignKey(SyncRun, on_delete=models.CASCADE, related_name="failures")
    provider_document_id = models.CharField(max_length=256)
    failure_type = models.CharField(max_length=24, choices=FailureType.choices)
    error_message = models.TextField()
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "importer_sync_item_failure"

    def __str__(self) -> str:
        return f"{self.sync_run_id}:{self.provider_document_id}"
