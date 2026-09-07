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
