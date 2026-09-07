"""ingest models -- IngestRun tracks one ingest attempt per (RawDocument, pipeline_version);
ProcessedChunk is the derived, regeneratable output (chunk text + embedding + full-text search
vector). raw_document_id stays a plain id, not a Django ForeignKey, matching every other
cross-app reference in this codebase (see apps.importer.RawDocument.connection_id) -- apps.ingest
must not import apps.importer's models as a hard dependency beyond reading RawDocument directly
in the pipeline entrypoint, and apps.retrieval must be able to read these models without pulling
in apps.importer at all.
"""

import hashlib
import secrets

from django.contrib.postgres.indexes import GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.db import models
from pgvector.django import VectorField

from apps.ingest.config import settings


def generate_id() -> str:
    return secrets.token_hex(12)


def make_chunk_id(raw_document_id: str, chunk_idx: int) -> str:
    return hashlib.sha256(f"{raw_document_id}:{chunk_idx}".encode()).hexdigest()[:24]


class IngestRun(models.Model):
    class Status(models.TextChoices):
        RUNNING = "running", "running"
        COMPLETED = "completed", "completed"
        FAILED = "failed", "failed"

    class Stage(models.TextChoices):
        PARSE = "parse", "parse"
        CHUNK = "chunk", "chunk"
        EMBED = "embed", "embed"
        INDEX = "index", "index"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    raw_document_id = models.CharField(db_index=True, max_length=24)
    pipeline_version = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RUNNING)
    failed_stage = models.CharField(max_length=16, choices=Stage.choices, blank=True, default="")
    error_message = models.TextField(blank=True, default="")
    started_at = models.DateTimeField(auto_now_add=True)
    finished_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "ingest_run"
        indexes = (models.Index(fields=["raw_document_id", "pipeline_version", "status"]),)
        constraints = (
            # Only one non-failed run may exist per (document, version) at a time -- failures
            # must stay retryable, so this excludes FAILED rather than being a flat unique pair.
            models.UniqueConstraint(
                fields=["raw_document_id", "pipeline_version"],
                condition=models.Q(status__in=["running", "completed"]),
                name="uniq_active_ingest_run",
            ),
        )

    def __str__(self) -> str:
        return f"{self.raw_document_id}:v{self.pipeline_version}:{self.status}"


class ProcessedChunk(models.Model):
    # chunk_id doubles as the primary key: it's already a deterministic natural key
    # (sha256 of raw_document_id + chunk_idx) and the bulk_create upsert key, so a separate
    # random id would just be a second value that must always agree with it.
    chunk_id = models.CharField(primary_key=True, max_length=24, editable=False)
    raw_document_id = models.CharField(db_index=True, max_length=24)
    chunk_idx = models.PositiveIntegerField()
    content = models.TextField()
    embedding = VectorField(dimensions=settings.embedding_dimensions)
    embedding_model = models.CharField(max_length=128)
    content_search = SearchVectorField(null=True)
    page_idx = models.PositiveIntegerField(null=True, blank=True)
    start_idx = models.PositiveIntegerField(null=True, blank=True)
    end_idx = models.PositiveIntegerField(null=True, blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "ingest_processed_chunk"
        indexes = (
            models.Index(fields=["raw_document_id", "chunk_idx"]),
            GinIndex(fields=["content_search"], name="ingest_chunk_search_gin"),
        )

    def __str__(self) -> str:
        return f"{self.raw_document_id}:{self.chunk_idx}"
