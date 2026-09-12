"""Accepting a file directly, with no connected app behind it.

RawDocument is immutable and owned by importer, so creating one belongs here whatever
the caller -- the upload endpoint, or another app that has been handed a file. Keeping
the write in one place is what stops "owned by importer" from being a comment rather
than a fact.
"""

import logging

from asgiref.sync import sync_to_async
from django.core.files.uploadedfile import UploadedFile
from temporalio.client import Client

from apps.importer.config import settings
from apps.importer.models import RawDocument, generate_id

logger = logging.getLogger(__name__)

# Mirrors apps.ingest.pipeline.parsers.PARSER_REGISTRY's keys exactly -- importer must not
# import apps.ingest (ingest depends on importer, never the reverse), so this list is kept
# in sync by hand. Update both together.
ALLOWED_UPLOAD_CONTENT_TYPES = frozenset(
    {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "text/plain",
        "text/markdown",
        "text/csv",
    }
)

# A directly-uploaded RawDocument has no real Connection behind it; this constant fills
# the (required, non-FK) connection_id column instead. Uniqueness still holds because
# provider_document_id is freshly generated per upload, never derived from the filename.
UPLOAD_CONNECTION_ID = "upload"


class UploadRejected(Exception):
    """The file cannot be accepted. The message is written for the person who chose it."""


def check_upload(upload: UploadedFile) -> str:
    """The file's content type, or a rejection naming what is wrong with it."""
    if upload.size > settings.max_upload_bytes:
        limit_mb = settings.max_upload_bytes // (1024 * 1024)
        raise UploadRejected(f"File exceeds the {limit_mb}MB limit")

    content_type = upload.content_type or ""
    if content_type not in ALLOWED_UPLOAD_CONTENT_TYPES:
        raise UploadRejected(f"Unsupported file type: {content_type}")
    return content_type


async def create_uploaded_document(
    *, project_id: str, upload: UploadedFile, trigger_ingest: bool
) -> RawDocument:
    """Stores the file and, when asked, queues it for the RAG pipeline.

    `trigger_ingest` is a decision the caller owns: a document a user uploaded to search
    belongs in the index, and one attached to a single interview does not.
    """
    content_type = check_upload(upload)
    document = await sync_to_async(_create_sync, thread_sensitive=True)(
        project_id=project_id,
        content_type=content_type,
        payload=upload.read(),
        display_name=upload.name or "",
    )
    if trigger_ingest:
        await _trigger_ingest(document.id)
    return document


def _create_sync(
    *, project_id: str, content_type: str, payload: bytes, display_name: str
) -> RawDocument:
    return RawDocument.objects.create(
        connection_id=UPLOAD_CONNECTION_ID,
        project_id=project_id,
        provider_document_id=generate_id(),
        content_type=content_type,
        display_name=display_name,
        payload=payload,
    )


async def _trigger_ingest(raw_document_id: str) -> None:
    """Starts IngesterWorkflow by its registered name, never importing apps.ingest --
    same plain-identifier convention as connection_id/raw_document_id everywhere else in
    this codebase, just applied to a workflow type instead of a database row. Nothing else
    triggers ingestion for this document if this fails (Temporal briefly unreachable,
    etc.) -- there is no sweep to fall back on, so a failure here is a real, logged gap.
    """
    try:
        client = await Client.connect(settings.temporal_address)
        await client.start_workflow(
            "IngesterWorkflow",
            raw_document_id,
            id=f"ingest-{raw_document_id}",
            task_queue=settings.ingest_task_queue,
        )
    except Exception:
        logger.warning(
            "Couldn't start an immediate ingest for %s; no sweep exists to retry it.",
            raw_document_id,
            exc_info=True,
        )
