from apps.ingest.config import settings
from apps.ingest.pipeline.embedders.fastembed_embedder import Embedder


def test_embed_returns_one_vector_per_text_at_configured_dimensions(fake_embedder):
    embedder = Embedder()
    vectors = embedder.embed(["a", "b", "c"])
    assert len(vectors) == 3
    assert all(len(v) == settings.embedding_dimensions for v in vectors)


def test_embed_empty_input_returns_empty_list(fake_embedder):
    embedder = Embedder()
    assert embedder.embed([]) == []
