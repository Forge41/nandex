from apps.ingest.models import ProcessedChunk, make_chunk_id
from apps.ingest.pipeline.chunkers.base import Chunk
from django.contrib.postgres.search import SearchVector


def index_chunks(
    raw_document_id: str,
    chunks: list[Chunk],
    vectors: list[list[float]],
    embedding_model: str,
) -> int:
    rows = [
        ProcessedChunk(
            chunk_id=make_chunk_id(raw_document_id, c.chunk_idx),
            raw_document_id=raw_document_id,
            chunk_idx=c.chunk_idx,
            content=c.text,
            embedding=vec,
            embedding_model=embedding_model,
            page_idx=c.page_idx,
            start_idx=c.start_idx,
            end_idx=c.end_idx,
            metadata=c.metadata,
        )
        for c, vec in zip(chunks, vectors, strict=True)
    ]
    ProcessedChunk.objects.bulk_create(
        rows,
        update_conflicts=True,
        unique_fields=["chunk_id"],
        update_fields=[
            "content",
            "embedding",
            "embedding_model",
            "page_idx",
            "start_idx",
            "end_idx",
            "metadata",
        ],
    )
    # A second, targeted pass: bulk_create's update_conflicts branch can't cleanly
    # reference the row's own just-written content in the same expression, so this
    # populates content_search right after, scoped to just this document.
    ProcessedChunk.objects.filter(raw_document_id=raw_document_id).update(
        content_search=SearchVector("content")
    )
    return len(rows)
