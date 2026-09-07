import pytest

from apps.retrieval.lanes.fts import search_fts_lane


@pytest.mark.django_db(transaction=True)
def test_lexical_match_ranks_above_no_match(make_chunk):
    match = make_chunk("doc-1", 0, "the quick brown fox jumps over the lazy dog")
    make_chunk("doc-1", 1, "completely unrelated sentence about something else")

    result = search_fts_lane("quick brown fox", None, limit=10)

    assert result[0] == match.chunk_id


@pytest.mark.django_db(transaction=True)
def test_filters_by_raw_document_ids(make_chunk):
    included = make_chunk("doc-1", 0, "quick brown fox")
    make_chunk("doc-2", 0, "quick brown fox")

    result = search_fts_lane("quick brown fox", ["doc-1"], limit=10)

    assert result == [included.chunk_id]


@pytest.mark.django_db(transaction=True)
def test_no_match_returns_empty(make_chunk):
    make_chunk("doc-1", 0, "the quick brown fox")

    result = search_fts_lane("nonexistent gibberish term", None, limit=10)

    assert result == []
