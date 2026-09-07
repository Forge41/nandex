from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class SearchResult:
    chunk_id: str
    raw_document_id: str
    content: str
    page_idx: int | None
    start_idx: int | None
    end_idx: int | None
    metadata: dict[str, Any]
    score: float


def apply_diversity_cap(
    results: list[SearchResult], max_chunks_per_source: int
) -> list[SearchResult]:
    """Assumes results are pre-sorted by score descending. A simple per-source cap, not MMR."""
    counts: dict[str, int] = {}
    capped = []
    for r in results:
        count = counts.get(r.raw_document_id, 0)
        if count >= max_chunks_per_source:
            continue
        counts[r.raw_document_id] = count + 1
        capped.append(r)
    return capped
