import pytest

from apps.ingest.config import settings as ingest_settings
from apps.retrieval.lanes.vector import search_vector_lane

DIM = ingest_settings.embedding_dimensions


def _unit(index: int) -> list[float]:
    vec = [0.0] * DIM
    vec[index] = 1.0
    return vec


@pytest.mark.django_db(transaction=True)
def test_orders_nearest_first(make_chunk):
    query = _unit(0)
    exact = make_chunk("doc-1", 0, "exact match", embedding=_unit(0))
    orthogonal = make_chunk("doc-1", 1, "orthogonal", embedding=_unit(1))
    opposite = make_chunk("doc-1", 2, "opposite", embedding=[-x for x in _unit(0)])

    result = search_vector_lane(query, None, ingest_settings.embedding_model_name, limit=10)

    assert result.index(exact.chunk_id) < result.index(orthogonal.chunk_id)
    assert result.index(orthogonal.chunk_id) < result.index(opposite.chunk_id)


@pytest.mark.django_db(transaction=True)
def test_filters_by_embedding_model(make_chunk):
    query = _unit(0)
    matching = make_chunk("doc-1", 0, "same model", embedding=_unit(0))
    make_chunk("doc-1", 1, "different model", embedding=_unit(0), embedding_model="other-model")

    result = search_vector_lane(query, None, ingest_settings.embedding_model_name, limit=10)

    assert result == [matching.chunk_id]


@pytest.mark.django_db(transaction=True)
def test_filters_by_raw_document_ids(make_chunk):
    query = _unit(0)
    included = make_chunk("doc-1", 0, "in scope", embedding=_unit(0))
    make_chunk("doc-2", 0, "out of scope", embedding=_unit(0))

    result = search_vector_lane(query, ["doc-1"], ingest_settings.embedding_model_name, limit=10)

    assert result == [included.chunk_id]
