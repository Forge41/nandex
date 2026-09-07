import dataclasses

from apps.ingest.pipeline.chunkers.base import Chunk
from apps.ingest.pipeline.chunkers.prose import ProseChunker
from apps.ingest.pipeline.chunkers.tabular import TabularChunker
from apps.ingest.pipeline.parsed_document import ParsedDocument


def chunk_document(parsed: ParsedDocument) -> list[Chunk]:
    chunks: list[Chunk] = []
    idx = 0
    for segment in parsed.segments:
        chunker = TabularChunker() if segment.type == "tabular" else ProseChunker()
        for c in chunker.chunk_segment(segment, start_idx=idx):
            chunks.append(dataclasses.replace(c, chunk_idx=idx))
            idx += 1
    return chunks
