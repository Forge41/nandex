import pytest

from apps.importer.models import RawDocument


@pytest.fixture
def make_raw_document(db):
    def _make(payload: bytes, content_type: str) -> RawDocument:
        return RawDocument.objects.create(
            connection_id="conn-test",
            provider_document_id="doc-test",
            payload=payload,
            content_type=content_type,
        )

    return _make


class FakeTextEmbedding:
    """Deterministic stand-in for fastembed.TextEmbedding -- never downloads a real model."""

    def __init__(self, *args, **kwargs):
        pass

    def embed(self, texts, batch_size=64):
        import numpy as np

        from apps.ingest.config import settings

        for i, _ in enumerate(texts):
            yield np.full(settings.embedding_dimensions, fill_value=(i + 1) / 100, dtype="float32")


@pytest.fixture
def fake_embedder(monkeypatch):
    from apps.ingest.pipeline.embedders import fastembed_embedder

    monkeypatch.setattr(fastembed_embedder, "TextEmbedding", FakeTextEmbedding)
    monkeypatch.setattr(fastembed_embedder, "_model", None)
    yield
    monkeypatch.setattr(fastembed_embedder, "_model", None)
