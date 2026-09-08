import asyncio
import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import AsyncClient, Client
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from apps.importer.models import RawDocument
from apps.ingest.tests.conftest import fake_embedder  # noqa: F401 -- reused as a fixture


def _client_with_project() -> tuple[Client, str]:
    client = Client()
    project_id = json.loads(client.get("/projects").content)[0]["id"]
    return client, project_id


@pytest.mark.django_db
def test_upload_creates_a_raw_document():
    client, project_id = _client_with_project()

    upload = SimpleUploadedFile("notes.txt", b"hello world", content_type="text/plain")
    resp = client.post("/documents/upload", data={"project_id": project_id, "file": upload})

    assert resp.status_code == 201
    raw_document_id = json.loads(resp.content)["id"]
    raw_document = RawDocument.objects.get(id=raw_document_id)
    assert raw_document.project_id == project_id
    assert raw_document.connection_id == "upload"
    assert raw_document.content_type == "text/plain"
    assert bytes(raw_document.payload) == b"hello world"


@pytest.mark.django_db
def test_upload_rejects_unsupported_content_type():
    client, project_id = _client_with_project()

    upload = SimpleUploadedFile("image.png", b"\x89PNG", content_type="image/png")
    resp = client.post("/documents/upload", data={"project_id": project_id, "file": upload})

    assert resp.status_code == 400


@pytest.mark.django_db
def test_upload_rejects_oversized_file(monkeypatch):
    from apps.importer.config import settings as importer_settings

    monkeypatch.setattr(importer_settings, "max_upload_bytes", 10)
    client, project_id = _client_with_project()

    upload = SimpleUploadedFile(
        "notes.txt", b"this is more than ten bytes", content_type="text/plain"
    )
    resp = client.post("/documents/upload", data={"project_id": project_id, "file": upload})

    assert resp.status_code == 400


@pytest.mark.django_db
def test_upload_requires_project_id():
    client, _ = _client_with_project()

    upload = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
    resp = client.post("/documents/upload", data={"file": upload})

    assert resp.status_code == 400


@pytest.mark.django_db
def test_upload_rejects_a_project_not_owned_by_the_caller():
    client, _ = _client_with_project()
    _, other_project_id = _client_with_project()

    upload = SimpleUploadedFile("notes.txt", b"hello", content_type="text/plain")
    resp = client.post("/documents/upload", data={"project_id": other_project_id, "file": upload})

    assert resp.status_code == 404


@pytest.mark.django_db(transaction=True)
async def test_upload_triggers_immediate_ingest(monkeypatch, fake_embedder):  # noqa: F811
    """Real end-to-end: an actual Temporal test server, a real ingest Worker registered on
    the exact task queue/workflow name the upload view starts by string -- proves the
    "no schedule wait" trigger genuinely reaches IngesterWorkflow, not just that the view
    calls something that doesn't crash.
    """
    from apps.importer.config import settings as importer_settings
    from apps.ingest.ingester.activities import ingest_document_activity
    from apps.ingest.ingester.workflows import IngesterWorkflow
    from apps.ingest.models import IngestRun, ProcessedChunk

    env = await WorkflowEnvironment.start_local()
    monkeypatch.setattr(
        importer_settings, "temporal_address", env.client.service_client.config.target_host
    )
    monkeypatch.setattr(importer_settings, "ingest_task_queue", "ingest")

    async with Worker(
        env.client,
        task_queue="ingest",
        workflows=[IngesterWorkflow],
        activities=[ingest_document_activity],
    ):
        client = AsyncClient()
        project_id = json.loads((await client.get("/projects")).content)[0]["id"]
        upload = SimpleUploadedFile(
            "notes.txt",
            b"Ada Lovelace wrote the first published algorithm.",
            content_type="text/plain",
        )
        resp = await client.post(
            "/documents/upload", data={"project_id": project_id, "file": upload}
        )
        assert resp.status_code == 201
        raw_document_id = json.loads(resp.content)["id"]

        deadline = asyncio.get_event_loop().time() + 10.0
        run = None
        while asyncio.get_event_loop().time() < deadline:
            run = await IngestRun.objects.filter(raw_document_id=raw_document_id).afirst()
            if run is not None and run.status != IngestRun.Status.RUNNING:
                break
            await asyncio.sleep(0.1)

    await env.shutdown()

    assert run is not None and run.status == IngestRun.Status.COMPLETED
    assert await ProcessedChunk.objects.filter(raw_document_id=raw_document_id).aexists()
