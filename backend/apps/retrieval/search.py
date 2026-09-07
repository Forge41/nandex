"""search() is retrieval's public entry point. It takes a caller-supplied
raw_document_ids allow-list rather than resolving "who can see what" itself -- permission
scoping happens upstream (a future apps.chat resolves the core->tps->importer->ingest id
chain), matching both this repo's module-boundary rules and the reference architecture's own
pattern of scoping before retrieval rather than filtering after it.
"""

from concurrent.futures import ThreadPoolExecutor

from apps.ingest.config import settings as ingest_settings
from apps.ingest.models import ProcessedChunk
from apps.retrieval.config import settings
from apps.retrieval.embedder import QueryEmbedder
from apps.retrieval.lanes.fts import search_fts_lane
from apps.retrieval.lanes.vector import search_vector_lane
from apps.retrieval.rerank import rerank
from apps.retrieval.results import SearchResult, apply_diversity_cap
from apps.retrieval.rrf import reciprocal_rank_fusion


def search(
    query: str, raw_document_ids: list[str] | None = None, top_k: int | None = None
) -> list[SearchResult]:
    top_k = top_k or settings.default_top_k
    query = query.strip()
    if not query:
        return _browse(raw_document_ids, top_k)

    overfetch = min(top_k * settings.lane_overfetch_multiplier, settings.lane_overfetch_cap)
    query_embedding = QueryEmbedder().embed_one(query)
    vector_ids = search_vector_lane(
        query_embedding, raw_document_ids, ingest_settings.embedding_model_name, overfetch
    )
    fts_ids = search_fts_lane(query, raw_document_ids, overfetch)

    fused = reciprocal_rank_fusion(
        lane_results={"vector": vector_ids, "fts": fts_ids},
        lane_weights={"vector": settings.vector_lane_weight, "fts": settings.fts_lane_weight},
        k=settings.rrf_k,
    )
    ordered_ids = [c.chunk_id for c in fused]
    scores = {c.chunk_id: c.score for c in fused}

    # One fetch for every fused candidate, reused both for rerank content and final assembly.
    rows = {row.chunk_id: row for row in ProcessedChunk.objects.filter(chunk_id__in=ordered_ids)}

    if settings.reranker_enabled and ordered_ids:
        candidate_ids = [
            cid for cid in ordered_ids[: settings.reranker_candidate_cap] if cid in rows
        ]
        pairs = [(cid, rows[cid].content) for cid in candidate_ids]
        try:
            with ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(rerank, query, pairs)
                reranked = future.result(timeout=settings.reranker_timeout_seconds)
            reranked_ids = [cid for cid, _ in reranked]
            tail_ids = [cid for cid in ordered_ids if cid not in set(reranked_ids)]
            ordered_ids = reranked_ids + tail_ids
            scores.update(dict(reranked))
        except Exception:
            pass  # fail open: keep the pre-rerank RRF order

    results = [
        SearchResult(
            chunk_id=cid,
            raw_document_id=rows[cid].raw_document_id,
            content=rows[cid].content,
            page_idx=rows[cid].page_idx,
            start_idx=rows[cid].start_idx,
            end_idx=rows[cid].end_idx,
            metadata=rows[cid].metadata,
            score=scores[cid],
        )
        for cid in ordered_ids
        if cid in rows
    ]
    results = apply_diversity_cap(results, settings.max_chunks_per_source)
    return results[:top_k]


def _browse(raw_document_ids: list[str] | None, top_k: int) -> list[SearchResult]:
    qs = ProcessedChunk.objects.all()
    if raw_document_ids is not None:
        qs = qs.filter(raw_document_id__in=raw_document_ids)
    rows = list(qs.order_by("-created_at", "chunk_id")[: top_k * settings.max_chunks_per_source])
    results = [
        SearchResult(
            chunk_id=r.chunk_id,
            raw_document_id=r.raw_document_id,
            content=r.content,
            page_idx=r.page_idx,
            start_idx=r.start_idx,
            end_idx=r.end_idx,
            metadata=r.metadata,
            score=0.0,
        )
        for r in rows
    ]
    return apply_diversity_cap(results, settings.max_chunks_per_source)[:top_k]
