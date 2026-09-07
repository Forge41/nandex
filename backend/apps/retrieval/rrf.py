from dataclasses import dataclass


@dataclass(frozen=True)
class FusedCandidate:
    chunk_id: str
    score: float


def reciprocal_rank_fusion(
    lane_results: dict[str, list[str]], lane_weights: dict[str, float], k: int
) -> list[FusedCandidate]:
    """lane_results: {"vector": [...chunk_ids...], "fts": [...chunk_ids...]} -- rank-based
    fusion, not score-based, since cosine distance and ts_rank live on incomparable scales."""
    scores: dict[str, float] = {}
    for lane_name, chunk_ids in lane_results.items():
        weight = lane_weights.get(lane_name, 1.0)
        for rank, chunk_id in enumerate(chunk_ids, start=1):
            scores[chunk_id] = scores.get(chunk_id, 0.0) + weight / (k + rank)

    return sorted(
        (FusedCandidate(chunk_id=cid, score=s) for cid, s in scores.items()),
        key=lambda c: (-c.score, c.chunk_id),
    )
