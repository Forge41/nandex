"""The portfolio's citable sources: portfolio/content/sources/<id>.md, front matter
`doc` and `title`, then the text. portfolio/lib/content.ts parses the same files for the
page's offline fallback; the two parsers must agree.
"""

import hashlib
import re
from dataclasses import dataclass
from pathlib import Path

_FRONT_MATTER = re.compile(r"^---\n(.*?)\n---\n+(.*)$", re.DOTALL)

PROVIDER_ID_PREFIX = "portfolio:"
# The page shows sources as "<doc> U+203A <title>"; kept identical here.
TITLE_SEPARATOR = "\u203a"


@dataclass(frozen=True)
class Source:
    id: str
    doc: str
    title: str
    text: str

    @property
    def provider_document_id(self) -> str:
        return PROVIDER_ID_PREFIX + self.id

    @property
    def display_name(self) -> str:
        return f"{self.doc} {TITLE_SEPARATOR} {self.title}"

    @property
    def payload(self) -> bytes:
        return f"# {self.title}\n\n{self.text}\n".encode()

    @property
    def version(self) -> str:
        return hashlib.sha256(self.payload).hexdigest()[:32]


def parse_source(source_id: str, raw: str) -> Source:
    match = _FRONT_MATTER.match(raw)
    if not match:
        raise ValueError(f"{source_id}.md has no front matter")
    meta = {}
    for line in match.group(1).splitlines():
        key, _, value = line.partition(":")
        meta[key.strip()] = value.strip()
    return Source(id=source_id, doc=meta["doc"], title=meta["title"], text=match.group(2).strip())


def load_corpus(corpus_dir: Path) -> list[Source]:
    return [parse_source(path.stem, path.read_text()) for path in sorted(corpus_dir.glob("*.md"))]
