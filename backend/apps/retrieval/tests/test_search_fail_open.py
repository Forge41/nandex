import pytest

from apps.retrieval import search as search_module


@pytest.mark.django_db(transaction=True)
def test_reranker_failure_falls_back_to_rrf_order(monkeypatch, make_chunk, fake_query_embedder):
    make_chunk("doc-1", 0, "quick brown fox jumps")
    make_chunk("doc-1", 1, "quick brown fox runs")

    def _raise(*args, **kwargs):
        raise RuntimeError("reranker exploded")

    monkeypatch.setattr(search_module, "rerank", _raise)

    results = search_module.search("quick brown fox", top_k=10)

    assert len(results) == 2
