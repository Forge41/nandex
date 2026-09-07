import re

from apps.ingest.config import settings
from apps.ingest.pipeline.chunkers.base import Chunk, estimate_tokens
from apps.ingest.pipeline.parsed_document import Segment

_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+")


class ProseChunker:
    def chunk_segment(self, segment: Segment, start_idx: int) -> list[Chunk]:
        sentences = [s for s in _SENTENCE_SPLIT.split(segment.text) if s.strip()]
        if not sentences:
            return []

        chunks: list[Chunk] = []
        current: list[str] = []
        current_tokens = 0.0
        char_offset = 0
        chunk_start_char = 0

        def flush() -> None:
            nonlocal current, current_tokens, chunk_start_char
            if not current:
                return
            text = " ".join(current)
            chunks.append(
                Chunk(
                    chunk_idx=0,
                    text=text,
                    page_idx=segment.page_idx,
                    start_idx=chunk_start_char,
                    end_idx=chunk_start_char + len(text),
                    metadata={"is_tabular": False},
                )
            )
            current = []
            current_tokens = 0.0

        for sentence in sentences:
            sentence_tokens = estimate_tokens(sentence)
            if current and current_tokens + sentence_tokens > settings.chunk_token_budget:
                flush()
                chunk_start_char = char_offset
            current.append(sentence)
            current_tokens += sentence_tokens
            char_offset += len(sentence) + 1

        flush()
        return chunks
