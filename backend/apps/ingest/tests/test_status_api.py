import json

import pytest
from django.test import Client

from apps.importer.models import RawDocument
from apps.ingest.config import settings
from apps.ingest.models import IngestRun


def _client_with_project() -> tuple[Client, str]:
    client = Client()
    project_id = json.loads(client.get("/projects").content)[0]["id"]
    return client, project_id


@pytest.mark.django_db
def test_status_is_pending_before_any_ingest_run():
    client, project_id = _client_with_project()
    raw_document = RawDocument.objects.create(
        connection_id="upload", project_id=project_id, provider_document_id="doc-a", payload=b"a"
    )

    resp = client.get(f"/documents/{raw_document.id}/ingest-status?project_id={project_id}")

    assert resp.status_code == 200
    assert json.loads(resp.content)["status"] == "pending"


@pytest.mark.django_db
def test_status_reflects_the_latest_ingest_run():
    client, project_id = _client_with_project()
    raw_document = RawDocument.objects.create(
        connection_id="upload", project_id=project_id, provider_document_id="doc-a", payload=b"a"
    )
    IngestRun.objects.create(
        raw_document_id=raw_document.id,
        pipeline_version=settings.pipeline_version,
        status=IngestRun.Status.COMPLETED,
    )

    resp = client.get(f"/documents/{raw_document.id}/ingest-status?project_id={project_id}")

    assert resp.status_code == 200
    assert json.loads(resp.content)["status"] == "completed"


@pytest.mark.django_db
def test_status_404s_for_a_project_not_owned_by_the_caller():
    client, _ = _client_with_project()
    _, other_project_id = _client_with_project()
    raw_document = RawDocument.objects.create(
        connection_id="upload",
        project_id=other_project_id,
        provider_document_id="doc-a",
        payload=b"a",
    )

    resp = client.get(f"/documents/{raw_document.id}/ingest-status?project_id={other_project_id}")

    assert resp.status_code == 404
