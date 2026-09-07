from apps.retrieval.rrf import reciprocal_rank_fusion


def test_fuses_ranks_across_lanes():
    lane_results = {"vector": ["a", "b", "c"], "fts": ["b", "a", "d"]}
    weights = {"vector": 1.0, "fts": 1.0}
    k = 60

    fused = reciprocal_rank_fusion(lane_results, weights, k)

    expected = {
        "a": 1 / (k + 1) + 1 / (k + 2),
        "b": 1 / (k + 2) + 1 / (k + 1),
        "c": 1 / (k + 3),
        "d": 1 / (k + 3),
    }
    fused_scores = {c.chunk_id: c.score for c in fused}
    for chunk_id, score in expected.items():
        assert fused_scores[chunk_id] == score

    # a and b tie (both appear at ranks 1 and 2 across the two lanes); tie-break is chunk_id asc.
    assert [c.chunk_id for c in fused[:2]] == ["a", "b"]


def test_weights_change_fused_order():
    lane_results = {"vector": ["a"], "fts": ["b"]}
    weights = {"vector": 0.1, "fts": 10.0}

    fused = reciprocal_rank_fusion(lane_results, weights, k=60)

    assert [c.chunk_id for c in fused] == ["b", "a"]


def test_deterministic_tie_break_by_chunk_id():
    lane_results = {"vector": ["z", "y"], "fts": ["y", "z"]}
    weights = {"vector": 1.0, "fts": 1.0}

    fused = reciprocal_rank_fusion(lane_results, weights, k=60)

    assert [c.chunk_id for c in fused] == ["y", "z"]


def test_chunk_only_in_one_lane_is_still_included():
    lane_results = {"vector": ["a"], "fts": []}

    fused = reciprocal_rank_fusion(lane_results, {"vector": 1.0, "fts": 1.0}, k=60)

    assert [c.chunk_id for c in fused] == ["a"]
