"""A retrieval-owned query embedder -- deliberately does not import
apps.ingest.pipeline.embedders (ingest's internal pipeline implementation); reads only
apps.ingest.config so the query vector stays comparable to what ingest wrote, without crossing
the pipeline-internals module boundary. Keeps its own separate lazy singleton rather than
sharing ingest's, since a shared global would be a hidden cross-app coupling.
"""

from fastembed import TextEmbedding

from apps.ingest.config import settings as ingest_settings

_model: TextEmbedding | None = None


def _get_model() -> TextEmbedding:
    global _model
    if _model is None:
        _model = TextEmbedding(
            model_name=ingest_settings.embedding_model_name,
            cache_dir=ingest_settings.fastembed_cache_dir,
        )
    return _model


class QueryEmbedder:
    model_name = ingest_settings.embedding_model_name
    dimensions = ingest_settings.embedding_dimensions

    def embed_one(self, text: str) -> list[float]:
        return next(_get_model().embed([text], batch_size=1)).tolist()
