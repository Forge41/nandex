import pytest

from apps.retrieval.embedder import QueryEmbedder
from apps.retrieval.search import search


@pytest.mark.e2e_real_model
@pytest.mark.django_db(transaction=True)
def test_search_returns_plausible_top_result(make_chunk):
    embedder = QueryEmbedder()
    make_chunk(
        "doc-1",
        0,
        "Ada Lovelace wrote the first published algorithm.",
        embedding=embedder.embed_one("Ada Lovelace wrote the first published algorithm."),
    )
    make_chunk(
        "doc-2",
        0,
        "The weather in Paris is mild in autumn.",
        embedding=embedder.embed_one("The weather in Paris is mild in autumn."),
    )

    results = search("Who wrote the first algorithm?", top_k=5)

    assert results
    assert results[0].raw_document_id == "doc-1"
