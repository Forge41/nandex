from apps.retrieval.rerank import rerank


def test_rerank_sorts_by_score_descending(fake_reranker):
    # FakeTextCrossEncoder scores by len(content), so longer content should rank higher.
    candidates = [("short-id", "hi"), ("long-id", "a much longer piece of content here")]

    result = rerank("irrelevant query", candidates)

    assert [cid for cid, _ in result] == ["long-id", "short-id"]


def test_rerank_empty_candidates_returns_empty(fake_reranker):
    assert rerank("query", []) == []
