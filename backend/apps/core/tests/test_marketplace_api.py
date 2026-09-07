import json

import pytest

from apps.core.api import marketplace_views


@pytest.fixture
def fake_tps_client(monkeypatch):
    apps = [
        {
            "id": "a1",
            "app_name": "google_drive",
            "display_name": "Google Drive",
            "category": "storage",
            "is_install_required": True,
            "meta": {},
        },
        {
            "id": "a2",
            "app_name": "github",
            "display_name": "GitHub",
            "category": "source_control",
            "is_install_required": True,
            "meta": {},
        },
    ]
    connections = [{"id": "c1", "app_name": "google_drive", "status": "active"}]

    async def list_apps(category=None):
        return apps

    async def list_connections(project_id):
        return connections

    async def install_app(app_name, state, redirect_uri):
        return f"https://provider.example/authorize?state={state}"

    async def connect_credentials(project_id, app_name, credentials):
        return {"id": "c2", "app_name": app_name, "status": "active"}

    async def exchange_code(project_id, app_name, code, redirect_uri):
        return {"id": "c3", "app_name": app_name, "status": "active"}

    async def delete_connection(project_id, connection_id):
        return connection_id == "c1"

    monkeypatch.setattr(marketplace_views.tps_client, "list_apps", list_apps)
    monkeypatch.setattr(marketplace_views.tps_client, "list_connections", list_connections)
    monkeypatch.setattr(marketplace_views.tps_client, "install_app", install_app)
    monkeypatch.setattr(marketplace_views.tps_client, "connect_credentials", connect_credentials)
    monkeypatch.setattr(marketplace_views.tps_client, "exchange_code", exchange_code)
    monkeypatch.setattr(marketplace_views.tps_client, "delete_connection", delete_connection)


def _project_id(client) -> str:
    resp = client.get("/projects")
    return json.loads(resp.content)[0]["id"]


@pytest.mark.django_db
def test_list_apps_groups_by_category(fake_tps_client):
    from django.test import Client

    resp = Client().get("/apps")
    assert resp.status_code == 200
    categories = json.loads(resp.content)["categories"]
    assert [a["app_name"] for a in categories["storage"]] == ["google_drive"]
    assert [a["app_name"] for a in categories["source_control"]] == ["github"]


@pytest.mark.django_db
def test_list_connections_requires_owned_project(logged_in_client, fake_tps_client):
    project_id = _project_id(logged_in_client)

    resp = logged_in_client.get(f"/connections?project_id={project_id}")
    assert resp.status_code == 200
    assert json.loads(resp.content)["connections"][0]["app_name"] == "google_drive"

    resp = logged_in_client.get("/connections?project_id=not-owned")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_install_app_returns_authorize_url(logged_in_client, fake_tps_client):
    project_id = _project_id(logged_in_client)
    resp = logged_in_client.post(
        "/apps/google_drive/install",
        data={"project_id": project_id},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert "authorize_url" in json.loads(resp.content)


@pytest.mark.django_db
def test_connect_app_requires_owned_project(logged_in_client, fake_tps_client):
    resp = logged_in_client.post(
        "/apps/github/connect",
        data={"project_id": "not-owned", "credentials": {}},
        content_type="application/json",
    )
    assert resp.status_code == 404


@pytest.mark.django_db
def test_oauth_callback_redirects_with_connected_app(logged_in_client, fake_tps_client):
    from apps.core.oauth_state import encode_state
    from apps.tps.catalog import IntegrationSlug

    project_id = _project_id(logged_in_client)
    state = encode_state(
        project_id=project_id, app_name=IntegrationSlug.GOOGLE_DRIVE, callback_path="/integrations"
    )
    resp = logged_in_client.get(f"/oauth/callback?code=abc123&state={state}")
    assert resp.status_code == 302
    assert "connected=google_drive" in resp["Location"]


@pytest.mark.django_db
def test_oauth_callback_bad_state_redirects_with_error(logged_in_client):
    resp = logged_in_client.get("/oauth/callback?code=abc123&state=garbage")
    assert resp.status_code == 302
    assert "error=invalid_state" in resp["Location"]


@pytest.mark.django_db
def test_delete_connection_requires_owned_project(logged_in_client, fake_tps_client):
    project_id = _project_id(logged_in_client)
    resp = logged_in_client.delete(f"/connections/c1?project_id={project_id}")
    assert resp.status_code == 200

    resp = logged_in_client.delete("/connections/c1?project_id=not-owned")
    assert resp.status_code == 404
