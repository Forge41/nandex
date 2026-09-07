import pytest

from apps.ingest.models import IngestRun, ProcessedChunk
from apps.ingest.pipeline.run import IngestAlreadyInFlightError, ingest_raw_document


@pytest.mark.e2e_real_model
@pytest.mark.django_db(transaction=True)
def test_ingest_raw_document_completes_end_to_end(make_raw_document):
    raw_document = make_raw_document(b"Ada Lovelace wrote the first algorithm.", "text/plain")

    run = ingest_raw_document(raw_document.id)

    assert run.status == IngestRun.Status.COMPLETED
    assert run.finished_at is not None
    chunks = ProcessedChunk.objects.filter(raw_document_id=raw_document.id)
    assert chunks.exists()
    for chunk in chunks:
        assert chunk.embedding is not None
        assert chunk.content_search is not None


@pytest.mark.django_db(transaction=True)
def test_ingest_raw_document_marks_failed_for_unsupported_type(make_raw_document, fake_embedder):
    raw_document = make_raw_document(b"\x89PNG", "image/png")

    run = ingest_raw_document(raw_document.id)

    assert run.status == IngestRun.Status.FAILED
    assert run.failed_stage == IngestRun.Stage.PARSE


@pytest.mark.django_db(transaction=True)
def test_ingest_raw_document_is_idempotent_when_already_completed(make_raw_document, fake_embedder):
    raw_document = make_raw_document(b"hello", "text/plain")

    first = ingest_raw_document(raw_document.id)
    second = ingest_raw_document(raw_document.id)

    assert first.id == second.id
    assert second.status == IngestRun.Status.COMPLETED


@pytest.mark.django_db(transaction=True)
def test_ingest_raw_document_raises_when_run_already_in_flight(make_raw_document, fake_embedder):
    raw_document = make_raw_document(b"hello", "text/plain")
    IngestRun.objects.create(raw_document_id=raw_document.id, pipeline_version=1)

    with pytest.raises(IngestAlreadyInFlightError):
        ingest_raw_document(raw_document.id)
