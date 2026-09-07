from apps.ingest.pipeline.chunkers import chunk_document
from apps.ingest.pipeline.parsed_document import ParsedDocument, Segment


def _rows(n: int) -> str:
    return "\n".join(f"value{i}\tother{i}" for i in range(n))


def test_short_tabular_segment_is_one_chunk_with_header():
    segment = Segment(type="tabular", text=_rows(3), header="col_a\tcol_b", row_range=(1, 3))
    parsed = ParsedDocument(segments=[segment], source_content_type="text/csv")
    chunks = chunk_document(parsed)
    assert len(chunks) == 1
    assert chunks[0].text.startswith("col_a\tcol_b")
    assert chunks[0].metadata == {"is_tabular": True, "row_range": [1, 3]}


def test_header_repeated_across_multiple_chunks():
    # Force a split by giving each row a huge token cost.
    huge_row = "x " * 500
    text = "\n".join([huge_row] * 4)
    segment = Segment(type="tabular", text=text, header="col_a\tcol_b", row_range=(1, 4))
    parsed = ParsedDocument(segments=[segment], source_content_type="text/csv")
    chunks = chunk_document(parsed)
    assert len(chunks) > 1
    assert all(c.text.startswith("col_a\tcol_b") for c in chunks)


def test_row_range_metadata_covers_all_rows_across_chunks():
    huge_row = "x " * 500
    text = "\n".join([huge_row] * 4)
    segment = Segment(type="tabular", text=text, header="h", row_range=(1, 4))
    parsed = ParsedDocument(segments=[segment], source_content_type="text/csv")
    chunks = chunk_document(parsed)
    ranges = [c.metadata["row_range"] for c in chunks]
    assert ranges[0][0] == 1
    assert ranges[-1][1] == 4


def test_empty_tabular_segment_produces_no_chunks():
    segment = Segment(type="tabular", text="", header="h", row_range=(1, 0))
    parsed = ParsedDocument(segments=[segment], source_content_type="text/csv")
    assert chunk_document(parsed) == []
