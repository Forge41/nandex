from typing import Protocol

from apps.ingest.pipeline.parsed_document import ParsedDocument


class Parser(Protocol):
    def parse(self, payload: bytes, content_type: str) -> ParsedDocument: ...


class UnsupportedContentTypeError(Exception):
    def __init__(self, content_type: str):
        super().__init__(f"No parser registered for content_type={content_type!r}")
        self.content_type = content_type
