from pgvector.django import CosineDistance

from apps.ingest.models import ProcessedChunk


def search_vector_lane(
    query_embedding: list[float],
    raw_document_ids: list[str] | None,
    embedding_model: str,
    limit: int,
) -> list[str]:
    """Returns chunk_ids ordered nearest-first by cosine distance. Filtering by
    embedding_model stops a future embedding-model migration from comparing vectors from two
    incompatible model spaces in one ranking."""
    qs = ProcessedChunk.objects.filter(embedding_model=embedding_model)
    if raw_document_ids is not None:
        qs = qs.filter(raw_document_id__in=raw_document_ids)
    qs = qs.annotate(distance=CosineDistance("embedding", query_embedding)).order_by("distance")
    return list(qs.values_list("chunk_id", flat=True)[:limit])
