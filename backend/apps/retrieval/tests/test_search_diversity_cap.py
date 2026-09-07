import pytest

from apps.retrieval import search as search_module


@pytest.mark.django_db(transaction=True)
def test_diversity_cap_limits_chunks_per_source(
    monkeypatch, make_chunk, fake_query_embedder, fake_reranker
):
    for i in range(5):
        make_chunk("doc-1", i, f"quick brown fox variant {i}")
    weak = make_chunk("doc-2", 0, "quick brown fox weaker match")

    monkeypatch.setattr(search_module.settings, "max_chunks_per_source", 2)

    results = search_module.search("quick brown fox", top_k=10)

    doc_1_count = sum(1 for r in results if r.raw_document_id == "doc-1")
    doc_2_ids = [r.chunk_id for r in results if r.raw_document_id == "doc-2"]

    assert doc_1_count <= 2
    assert weak.chunk_id in doc_2_ids
