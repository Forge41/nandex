import pytest
from django.contrib.postgres.search import SearchVector

from apps.ingest.config import settings as ingest_settings
from apps.ingest.models import ProcessedChunk, make_chunk_id


@pytest.fixture
def make_chunk(db):
    def _make(raw_document_id, chunk_idx, content, embedding=None, embedding_model=None, **kwargs):
        chunk = ProcessedChunk.objects.create(
            chunk_id=make_chunk_id(raw_document_id, chunk_idx),
            raw_document_id=raw_document_id,
            chunk_idx=chunk_idx,
            content=content,
            embedding=embedding or [0.0] * ingest_settings.embedding_dimensions,
            embedding_model=embedding_model or ingest_settings.embedding_model_name,
            **kwargs,
        )
        ProcessedChunk.objects.filter(chunk_id=chunk.chunk_id).update(
            content_search=SearchVector("content")
        )
        return ProcessedChunk.objects.get(chunk_id=chunk.chunk_id)

    return _make


class FakeTextEmbedding:
    """Deterministic stand-in for fastembed.TextEmbedding -- never downloads a real model.
    Kept independent of apps.ingest.tests's copy so the two test suites don't share state."""

    def __init__(self, *args, **kwargs):
        pass

    def embed(self, texts, batch_size=64):
        import numpy as np

        for i, _ in enumerate(texts):
            yield np.full(
                ingest_settings.embedding_dimensions, fill_value=(i + 1) / 100, dtype="float32"
            )


@pytest.fixture
def fake_query_embedder(monkeypatch):
    from apps.retrieval import embedder as embedder_module

    monkeypatch.setattr(embedder_module, "TextEmbedding", FakeTextEmbedding)
    monkeypatch.setattr(embedder_module, "_model", None)
    yield
    monkeypatch.setattr(embedder_module, "_model", None)


class FakeTextCrossEncoder:
    """Deterministic stand-in for fastembed's TextCrossEncoder -- scores by content length,
    just enough determinism to assert ordering without downloading a real model."""

    def __init__(self, *args, **kwargs):
        pass

    def rerank(self, query, documents, batch_size=64, **kwargs):
        return [float(len(d)) for d in documents]


@pytest.fixture
def fake_reranker(monkeypatch):
    from apps.retrieval import rerank as rerank_module

    monkeypatch.setattr(rerank_module, "TextCrossEncoder", FakeTextCrossEncoder)
    monkeypatch.setattr(rerank_module, "_model", None)
    yield
    monkeypatch.setattr(rerank_module, "_model", None)
