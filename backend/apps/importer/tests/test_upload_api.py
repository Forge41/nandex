import json

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client

from apps.importer.models import RawDocument


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
