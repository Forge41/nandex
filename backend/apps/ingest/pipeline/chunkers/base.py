from dataclasses import dataclass
from typing import Protocol

from apps.ingest.config import settings
from apps.ingest.pipeline.parsed_document import Segment


@dataclass(frozen=True)
class Chunk:
    chunk_idx: int
    text: str
    page_idx: int | None
    start_idx: int | None
    end_idx: int | None
    metadata: dict


class Chunker(Protocol):
    def chunk_segment(self, segment: Segment, start_idx: int) -> list[Chunk]: ...


def estimate_tokens(text: str) -> float:
    # Approximate, not exact: a whitespace word count scaled by an empirical
    # words-to-subword-tokens factor for an English WordPiece/BPE tokenizer (like the
    # default embedding model's). fastembed exposes no stable public tokenizer attribute
    # across versions, so budgets here are treated as approximate rather than precise.
    return len(text.split()) / settings.words_per_token_estimate
