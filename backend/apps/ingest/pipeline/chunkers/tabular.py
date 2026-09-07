from apps.ingest.config import settings
from apps.ingest.pipeline.chunkers.base import Chunk, estimate_tokens
from apps.ingest.pipeline.parsed_document import Segment


class TabularChunker:
    def chunk_segment(self, segment: Segment, start_idx: int) -> list[Chunk]:
        rows = [r for r in segment.text.split("\n") if r]
        if not rows:
            return []

        header = segment.header or ""
        header_tokens = estimate_tokens(header)
        first_row = segment.row_range[0] if segment.row_range else 0

        chunks: list[Chunk] = []
        current_rows: list[str] = []
        current_tokens = header_tokens
        chunk_first_row = first_row

        def flush(last_row: int) -> None:
            nonlocal current_rows, current_tokens, chunk_first_row
            if not current_rows:
                return
            text = "\n".join([header, *current_rows]) if header else "\n".join(current_rows)
            chunks.append(
                Chunk(
                    chunk_idx=0,
                    text=text,
                    page_idx=segment.page_idx,
                    start_idx=None,
                    end_idx=None,
                    metadata={"is_tabular": True, "row_range": [chunk_first_row, last_row]},
                )
            )
            current_rows = []
            current_tokens = header_tokens

        for offset, row in enumerate(rows):
            row_number = first_row + offset
            row_tokens = estimate_tokens(row)
            # A single row's own text budget always includes the header's cost, so a
            # wide header-heavy sheet can't silently produce an oversized chunk.
            if current_rows and current_tokens + row_tokens > settings.chunk_token_budget:
                flush(row_number - 1)
                chunk_first_row = row_number
            current_rows.append(row)
            current_tokens += row_tokens

        flush(first_row + len(rows) - 1)
        return chunks
