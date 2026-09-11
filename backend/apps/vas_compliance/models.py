"""Deletion requests against a session's recorded artifacts.

session_id is a plain CharField rather than a ForeignKey to vas_recordings.VideoSession:
this app is reached only through its own service layer, and a hard relation would make
the two apps un-splittable.
"""

import secrets

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class ArtifactDeletion(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "pending"
        IN_PROGRESS = "in_progress", "in_progress"
        COMPLETE = "complete", "complete"
        FAILED = "failed", "failed"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session_id = models.CharField(db_index=True, max_length=24)
    requested_by = models.CharField(max_length=255)
    reason = models.TextField(blank=True, default="")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    gcs_deleted = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "vas_artifact_deletion"

    def __str__(self) -> str:
        return f"{self.session_id}:{self.status}"
