import pytest

from apps.chat.scoping import resolve_visible_raw_document_ids
from apps.importer.models import RawDocument


@pytest.mark.django_db(transaction=True)
async def test_resolves_raw_document_ids_for_project_connections(fake_connections):
    fake_connections([{"id": "conn-1"}, {"id": "conn-2"}])
    await RawDocument.objects.acreate(
        connection_id="conn-1", provider_document_id="doc-a", payload=b"a"
    )
    await RawDocument.objects.acreate(
        connection_id="conn-2", provider_document_id="doc-b", payload=b"b"
    )
    await RawDocument.objects.acreate(
        connection_id="conn-other", provider_document_id="doc-c", payload=b"c"
    )

    doc_ids = await resolve_visible_raw_document_ids("proj-1")

    assert len(doc_ids) == 2


@pytest.mark.django_db(transaction=True)
async def test_no_connections_returns_empty(fake_connections):
    fake_connections([])

    doc_ids = await resolve_visible_raw_document_ids("proj-1")

    assert doc_ids == []


@pytest.mark.django_db(transaction=True)
async def test_uploaded_documents_are_visible_by_project_id_alone(fake_connections):
    fake_connections([])
    uploaded = await RawDocument.objects.acreate(
        connection_id="upload", project_id="proj-1", provider_document_id="doc-a", payload=b"a"
    )
    await RawDocument.objects.acreate(
        connection_id="upload", project_id="proj-other", provider_document_id="doc-b", payload=b"b"
    )

    doc_ids = await resolve_visible_raw_document_ids("proj-1")

    assert doc_ids == [uploaded.id]


@pytest.mark.django_db(transaction=True)
async def test_uploaded_and_synced_documents_are_both_visible(fake_connections):
    fake_connections([{"id": "conn-1"}])
    synced = await RawDocument.objects.acreate(
        connection_id="conn-1", provider_document_id="doc-a", payload=b"a"
    )
    uploaded = await RawDocument.objects.acreate(
        connection_id="upload", project_id="proj-1", provider_document_id="doc-b", payload=b"b"
    )

    doc_ids = await resolve_visible_raw_document_ids("proj-1")

    assert set(doc_ids) == {synced.id, uploaded.id}
