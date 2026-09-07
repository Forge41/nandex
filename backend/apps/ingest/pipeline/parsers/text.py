from apps.ingest.pipeline.parsed_document import ParsedDocument, Segment


class TextParser:
    def parse(self, payload: bytes, content_type: str) -> ParsedDocument:
        text = payload.decode("utf-8", errors="replace")
        return ParsedDocument(
            segments=[Segment(type="prose", text=text)], source_content_type=content_type
        )
