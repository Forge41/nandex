import io

from pypdf import PdfReader

from apps.ingest.pipeline.parsed_document import ParsedDocument, Segment


class PdfParser:
    def parse(self, payload: bytes, content_type: str) -> ParsedDocument:
        reader = PdfReader(io.BytesIO(payload))
        segments = [
            # Empty text (e.g. a scanned page with no OCR) is a valid, expected result here,
            # not an error -- OCR is a deferred follow-up, not something this parser attempts.
            Segment(type="prose", page_idx=i, text=page.extract_text() or "")
            for i, page in enumerate(reader.pages)
        ]
        return ParsedDocument(segments=segments, source_content_type=content_type)
