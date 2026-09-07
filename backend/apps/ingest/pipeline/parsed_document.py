"""The shared intermediate between parsers and chunkers. Kept as an in-memory dataclass,
not persisted to blob storage the way a slower pipeline stage's output would be: RawDocument
payloads are capped at ~25MB and there's no OCR step to amortize, so re-parsing on demand is
cheap and this project has no object store to cache it in yet.
"""

from dataclasses import dataclass
from typing import Literal

SegmentType = Literal["prose", "tabular"]


@dataclass(frozen=True)
class Segment:
    type: SegmentType
    text: str
    page_idx: int | None = None
    row_range: tuple[int, int] | None = None  # tabular only
    header: str | None = None  # tabular only


@dataclass(frozen=True)
class ParsedDocument:
    segments: list[Segment]
    source_content_type: str
