from fastembed.rerank.cross_encoder import TextCrossEncoder

from apps.ingest.config import settings as ingest_settings
from apps.retrieval.config import settings

_model: TextCrossEncoder | None = None


def _get_model() -> TextCrossEncoder:
    global _model
    if _model is None:
        _model = TextCrossEncoder(
            model_name=settings.reranker_model_name,
            cache_dir=settings.reranker_cache_dir or ingest_settings.fastembed_cache_dir,
        )
    return _model


def rerank(query: str, candidates: list[tuple[str, str]]) -> list[tuple[str, float]]:
    """candidates: (chunk_id, content) pairs. Returns (chunk_id, score) sorted best-first.

    Raises on model-load or scoring failure -- the caller (search.py) owns the fail-open
    fallback, so that policy stays visible at the call site rather than hidden in here.
    """
    if not candidates:
        return []
    chunk_ids, contents = zip(*candidates, strict=True)
    scores = list(_get_model().rerank(query, list(contents)))
    return sorted(zip(chunk_ids, scores, strict=True), key=lambda p: p[1], reverse=True)
