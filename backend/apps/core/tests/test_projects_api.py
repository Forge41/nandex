import json
import re

import pytest
from django.core import mail
from django.test import Client


@pytest.fixture
def logged_in_client(db) -> Client:
    client = Client()
    client.post("/auth/login", data={"email": "dev@example.com"}, content_type="application/json")
    token = re.search(r"token=(\S+)", mail.outbox[-1].body).group(1)
    resp = client.post("/auth/verify", data={"token": token}, content_type="application/json")
    assert resp.status_code == 200
    return client


@pytest.mark.django_db
def test_projects_requires_auth():
    resp = Client().get("/projects")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_login_creates_default_project(logged_in_client):
    resp = logged_in_client.get("/projects")
    assert resp.status_code == 200
    names = [p["name"] for p in json.loads(resp.content)]
    assert names == ["Default"]


@pytest.mark.django_db
def test_create_list_update_delete_project(logged_in_client):
    create_resp = logged_in_client.post(
        "/projects",
        data={"name": " My Project ", "description": "test project"},
        content_type="application/json",
    )
    assert create_resp.status_code == 201
    project = json.loads(create_resp.content)
    assert project["name"] == "My Project"

    list_resp = logged_in_client.get("/projects")
    assert {p["name"] for p in json.loads(list_resp.content)} == {"Default", "My Project"}

    update_resp = logged_in_client.patch(
        f"/projects/{project['id']}",
        data=json.dumps({"name": "Renamed"}),
        content_type="application/json",
    )
    assert update_resp.status_code == 200
    assert json.loads(update_resp.content)["name"] == "Renamed"

    delete_resp = logged_in_client.delete(f"/projects/{project['id']}")
    assert delete_resp.status_code == 200

    final_resp = logged_in_client.get("/projects")
    assert {p["name"] for p in json.loads(final_resp.content)} == {"Default"}


@pytest.mark.django_db
def test_get_unknown_project_404s(logged_in_client):
    resp = logged_in_client.get("/projects/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_logout_then_projects_requires_auth_again(logged_in_client):
    logged_in_client.post("/auth/logout")
    resp = logged_in_client.get("/projects")
    assert resp.status_code == 401
