import pytest

from apps.retrieval import search as search_module


@pytest.mark.django_db(transaction=True)
def test_empty_query_never_calls_lanes(monkeypatch, make_chunk):
    make_chunk("doc-1", 0, "some content")

    def _raise(*args, **kwargs):
        raise AssertionError("lane should not be called in browse mode")

    monkeypatch.setattr(search_module, "search_vector_lane", _raise)
    monkeypatch.setattr(search_module, "search_fts_lane", _raise)

    results = search_module.search("", top_k=10)

    assert len(results) == 1
    assert results[0].score == 0.0


@pytest.mark.django_db(transaction=True)
def test_browse_mode_respects_raw_document_ids_filter(make_chunk):
    included = make_chunk("doc-1", 0, "in scope")
    make_chunk("doc-2", 0, "out of scope")

    results = search_module.search("   ", raw_document_ids=["doc-1"], top_k=10)

    assert [r.chunk_id for r in results] == [included.chunk_id]
