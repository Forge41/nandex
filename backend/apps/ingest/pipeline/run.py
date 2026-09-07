"""ingest_raw_document() is the pipeline's synchronous entry point. It's written so it can
drop in unchanged as the body of a future IngesterWorkflow Temporal activity (one raw_document_id
in, one IngestRun out, no cross-call state) -- Temporal orchestration itself (the
initiator/ingester workflow split, the importer -> ingest handoff) is deferred to a follow-up.
"""

from django.db import IntegrityError
from django.utils import timezone

from apps.importer.models import RawDocument
from apps.ingest.config import settings
from apps.ingest.models import IngestRun
from apps.ingest.pipeline.chunkers import chunk_document
from apps.ingest.pipeline.embedders.fastembed_embedder import Embedder
from apps.ingest.pipeline.indexers.postgres_indexer import index_chunks
from apps.ingest.pipeline.parsers import get_parser


class IngestAlreadyInFlightError(Exception):
    pass


def ingest_raw_document(raw_document_id: str) -> IngestRun:
    existing = (
        IngestRun.objects.filter(
            raw_document_id=raw_document_id, pipeline_version=settings.pipeline_version
        )
        .exclude(status=IngestRun.Status.FAILED)
        .first()
    )
    if existing:
        if existing.status == IngestRun.Status.COMPLETED:
            return existing
        raise IngestAlreadyInFlightError(raw_document_id)

    # uniq_active_ingest_run (a partial unique constraint excluding FAILED rows) is what
    # actually closes the race between two concurrent callers -- the query above can't, since
    # it may see zero existing rows for both callers.
    try:
        run = IngestRun.objects.create(
            raw_document_id=raw_document_id, pipeline_version=settings.pipeline_version
        )
    except IntegrityError as e:
        raise IngestAlreadyInFlightError(raw_document_id) from e

    def _fail(stage: str, exc: Exception) -> IngestRun:
        run.status = IngestRun.Status.FAILED
        run.failed_stage = stage
        run.error_message = str(exc)
        run.finished_at = timezone.now()
        run.save(update_fields=["status", "failed_stage", "error_message", "finished_at"])
        return run

    try:
        raw_document = RawDocument.objects.get(id=raw_document_id)
        parser = get_parser(raw_document.content_type)
        parsed = parser.parse(bytes(raw_document.payload), raw_document.content_type)
    except Exception as e:
        return _fail(IngestRun.Stage.PARSE, e)

    try:
        chunks = chunk_document(parsed)
    except Exception as e:
        return _fail(IngestRun.Stage.CHUNK, e)

    try:
        embedder = Embedder()
        vectors = embedder.embed([c.text for c in chunks]) if chunks else []
    except Exception as e:
        return _fail(IngestRun.Stage.EMBED, e)

    try:
        index_chunks(raw_document_id, chunks, vectors, embedder.model_name)
    except Exception as e:
        return _fail(IngestRun.Stage.INDEX, e)

    run.status = IngestRun.Status.COMPLETED
    run.finished_at = timezone.now()
    run.save(update_fields=["status", "finished_at"])  # commit-marker written last
    return run
