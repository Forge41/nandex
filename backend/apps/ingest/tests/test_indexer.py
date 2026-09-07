import pytest

from apps.ingest.models import ProcessedChunk, make_chunk_id
from apps.ingest.pipeline.chunkers.base import Chunk
from apps.ingest.pipeline.indexers.postgres_indexer import index_chunks


@pytest.mark.django_db(transaction=True)
def test_index_chunks_writes_rows():
    chunks = [
        Chunk(chunk_idx=0, text="alpha", page_idx=0, start_idx=0, end_idx=5, metadata={}),
        Chunk(chunk_idx=1, text="beta", page_idx=0, start_idx=5, end_idx=9, metadata={}),
    ]
    vectors = [[0.1] * 384, [0.2] * 384]

    count = index_chunks("doc-1", chunks, vectors, "test-model")

    assert count == 2
    assert ProcessedChunk.objects.filter(raw_document_id="doc-1").count() == 2
    row = ProcessedChunk.objects.get(chunk_id=make_chunk_id("doc-1", 0))
    assert row.content == "alpha"
    assert row.content_search is not None


@pytest.mark.django_db(transaction=True)
def test_index_chunks_is_idempotent_upsert():
    chunks = [Chunk(chunk_idx=0, text="alpha", page_idx=0, start_idx=0, end_idx=5, metadata={})]
    index_chunks("doc-2", chunks, [[0.1] * 384], "test-model")

    updated_chunks = [
        Chunk(chunk_idx=0, text="alpha-updated", page_idx=0, start_idx=0, end_idx=13, metadata={})
    ]
    index_chunks("doc-2", updated_chunks, [[0.9] * 384], "test-model")

    assert ProcessedChunk.objects.filter(raw_document_id="doc-2").count() == 1
    row = ProcessedChunk.objects.get(raw_document_id="doc-2", chunk_idx=0)
    assert row.content == "alpha-updated"
