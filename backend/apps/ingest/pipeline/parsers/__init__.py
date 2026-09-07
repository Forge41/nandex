from apps.ingest.pipeline.parsers.base import Parser, UnsupportedContentTypeError
from apps.ingest.pipeline.parsers.csv import CsvParser
from apps.ingest.pipeline.parsers.docx import DocxParser
from apps.ingest.pipeline.parsers.pdf import PdfParser
from apps.ingest.pipeline.parsers.pptx import PptxParser
from apps.ingest.pipeline.parsers.text import TextParser
from apps.ingest.pipeline.parsers.xlsx import XlsxParser

# image/png (Google Drawing exports) is deliberately absent: OCR is out of scope for this
# pass, so an image-only RawDocument fails cleanly at PARSE rather than being silently
# treated as text.
PARSER_REGISTRY: dict[str, type[Parser]] = {
    "application/pdf": PdfParser,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": DocxParser,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": XlsxParser,
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": PptxParser,
    "text/plain": TextParser,
    "text/markdown": TextParser,
    "text/csv": CsvParser,
}


def get_parser(content_type: str) -> Parser:
    parser_cls = PARSER_REGISTRY.get(content_type)
    if parser_cls is None:
        raise UnsupportedContentTypeError(content_type)
    return parser_cls()
