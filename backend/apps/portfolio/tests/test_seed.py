import pytest
from django.core.management import call_command

from apps.importer.models import RawDocument
from apps.ingest.models import IngestRun
from apps.portfolio.management.commands import seed_portfolio
from apps.portfolio.service import current_documents_sync


@pytest.fixture
def fake_ingest(monkeypatch):
    ingested = []

    def ingest_raw_document(raw_document_id):
        ingested.append(raw_document_id)
        return IngestRun(raw_document_id=raw_document_id, status=IngestRun.Status.COMPLETED)

    monkeypatch.setattr(seed_portfolio, "ingest_raw_document", ingest_raw_document)
    return ingested


@pytest.mark.django_db
def test_seed_is_idempotent(corpus_dir, fake_ingest):
    corpus_dir({"alpha": "one", "beta": "two"})
    call_command("seed_portfolio")
    call_command("seed_portfolio")

    assert RawDocument.objects.filter(project_id="portfolio").count() == 2
    assert {s.id for s in current_documents_sync().values()} == {"alpha", "beta"}


@pytest.mark.django_db
def test_a_changed_source_is_stored_as_a_new_version_and_only_it_is_in_scope(
    corpus_dir, fake_ingest
):
    corpus_dir({"alpha": "one"})
    call_command("seed_portfolio")
    corpus_dir({"alpha": "one, revised"})
    call_command("seed_portfolio")

    assert RawDocument.objects.filter(provider_document_id="portfolio:alpha").count() == 2
    newest = RawDocument.objects.filter(provider_document_id="portfolio:alpha").latest("fetched_at")
    assert list(current_documents_sync()) == [newest.id]
    assert current_documents_sync()[newest.id].text == "one, revised"


@pytest.mark.django_db
def test_a_removed_source_falls_out_of_scope(corpus_dir, fake_ingest):
    corpus_dir({"alpha": "one", "beta": "two"})
    call_command("seed_portfolio")
    corpus_dir({"alpha": "one"})

    assert [s.id for s in current_documents_sync().values()] == ["alpha"]


@pytest.mark.django_db
def test_other_projects_documents_are_never_in_scope(corpus_dir, fake_ingest):
    corpus_dir({"alpha": "one"})
    RawDocument.objects.create(
        connection_id="upload",
        project_id="someone-else",
        provider_document_id="portfolio:alpha",
        provider_version="spoof",
        payload=b"not mine",
    )
    call_command("seed_portfolio")

    scope = current_documents_sync()
    assert len(scope) == 1
    assert RawDocument.objects.get(id=next(iter(scope))).project_id == "portfolio"
