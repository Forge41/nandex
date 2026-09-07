import csv
import io

from apps.ingest.pipeline.parsed_document import ParsedDocument, Segment


class CsvParser:
    def parse(self, payload: bytes, content_type: str) -> ParsedDocument:
        text = payload.decode("utf-8", errors="replace")
        rows = list(csv.reader(io.StringIO(text)))
        if not rows:
            return ParsedDocument(segments=[], source_content_type=content_type)

        header, body = rows[0], rows[1:]
        segment = Segment(
            type="tabular",
            text="\n".join("\t".join(row) for row in body),
            row_range=(1, len(body)),
            header="\t".join(header),
        )
        return ParsedDocument(segments=[segment], source_content_type=content_type)
