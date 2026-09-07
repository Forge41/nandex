from apps.ingest.config import settings
from fastembed import TextEmbedding

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(
            model_name=settings.embedding_model_name, cache_dir=settings.fastembed_cache_dir
        )
    return _model


class Embedder:
    model_name = settings.embedding_model_name
    dimensions = settings.embedding_dimensions

    def embed(self, texts: list[str]) -> list[list[float]]:
        vectors = _get_model().embed(texts, batch_size=settings.embed_batch_size)
        return [v.tolist() for v in vectors]
