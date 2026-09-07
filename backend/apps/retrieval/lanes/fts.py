from django.contrib.postgres.search import SearchQuery, SearchRank

from apps.ingest.models import ProcessedChunk


def search_fts_lane(query_text: str, raw_document_ids: list[str] | None, limit: int) -> list[str]:
    """Returns chunk_ids ordered by ts_rank against content_search, descending."""
    # No explicit config= here, deliberately: apps.ingest's indexer populates content_search
    # via SearchVector("content") with no config= either, so it uses Postgres's
    # default_text_search_config. A different config here than at write time silently produces
    # a language mismatch that still runs but ranks poorly -- omitting it on both sides keeps
    # them self-consistently matched regardless of what the DB's default actually is.
    search_query = SearchQuery(query_text)
    qs = ProcessedChunk.objects.filter(content_search=search_query)
    if raw_document_ids is not None:
        qs = qs.filter(raw_document_id__in=raw_document_ids)
    qs = qs.annotate(rank=SearchRank("content_search", search_query)).order_by("-rank")
    return list(qs.values_list("chunk_id", flat=True)[:limit])
