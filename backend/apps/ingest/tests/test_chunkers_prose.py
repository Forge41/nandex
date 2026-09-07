from apps.ingest.pipeline.chunkers import chunk_document
from apps.ingest.pipeline.parsed_document import ParsedDocument, Segment


def test_short_segment_is_one_chunk():
    segment = Segment(type="prose", text="One sentence. Another one.")
    parsed = ParsedDocument(segments=[segment], source_content_type="text/plain")
    chunks = chunk_document(parsed)
    assert len(chunks) == 1
    assert chunks[0].chunk_idx == 0
    assert chunks[0].metadata == {"is_tabular": False}


def test_oversized_segment_splits_into_multiple_chunks():
    sentence = "word " * 100 + "."
    text = " ".join([sentence] * 6)
    segment = Segment(type="prose", text=text)
    parsed = ParsedDocument(segments=[segment], source_content_type="text/plain")
    chunks = chunk_document(parsed)
    assert len(chunks) > 1
    assert [c.chunk_idx for c in chunks] == list(range(len(chunks)))


def test_single_oversized_sentence_is_still_one_chunk():
    huge_sentence = "word " * 1000 + "."
    segment = Segment(type="prose", text=huge_sentence)
    parsed = ParsedDocument(segments=[segment], source_content_type="text/plain")
    chunks = chunk_document(parsed)
    assert len(chunks) == 1
    assert chunks[0].text.strip() == huge_sentence.strip()


def test_empty_segment_produces_no_chunks():
    segment = Segment(type="prose", text="   ")
    parsed = ParsedDocument(segments=[segment], source_content_type="text/plain")
    assert chunk_document(parsed) == []
