import pytest

from apps.portfolio.config import Settings
from apps.portfolio.corpus import TITLE_SEPARATOR, load_corpus, parse_source


def test_parse_source_reads_front_matter_and_body():
    source = parse_source(
        "resume-sde2", "---\ndoc: resume.pdf\ntitle: SDE-II: Harvey\n---\n\nBuilt RAG.\n"
    )
    assert (source.doc, source.title, source.text) == ("resume.pdf", "SDE-II: Harvey", "Built RAG.")
    assert source.provider_document_id == "portfolio:resume-sde2"
    assert source.display_name == f"resume.pdf {TITLE_SEPARATOR} SDE-II: Harvey"


def test_version_changes_with_the_text_only():
    a = parse_source("x", "---\ndoc: d\ntitle: t\n---\n\none")
    assert a.version == parse_source("x", "---\ndoc: d\ntitle: t\n---\n\none").version
    assert a.version != parse_source("x", "---\ndoc: d\ntitle: t\n---\n\ntwo").version


def test_parse_source_rejects_a_file_without_front_matter():
    with pytest.raises(ValueError):
        parse_source("x", "just text")


def test_the_shipped_corpus_parses():
    sources = load_corpus(Settings().corpus_dir)
    assert len(sources) >= 10
    assert all(s.doc and s.title and s.text for s in sources)
