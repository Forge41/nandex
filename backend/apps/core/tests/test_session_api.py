import json

import pytest
from django.test import Client


@pytest.mark.django_db
def test_session_auto_provisions_a_brand_new_visitor():
    client = Client()
    resp = client.get("/auth/session")
    assert resp.status_code == 200
    body = json.loads(resp.content)
    assert body["user"]["id"]
    assert body["workspace"]["slug"]

    # Same browser (same session cookie) -> the same identity on a second request.
    second = json.loads(client.get("/auth/session").content)
    assert second["user"]["id"] == body["user"]["id"]


@pytest.mark.django_db
def test_session_returns_user_and_workspace(logged_in_client):
    resp = logged_in_client.get("/auth/session")
    assert resp.status_code == 200
    body = json.loads(resp.content)
    assert body["user"]["email"] == "dev@example.com"
    assert body["workspace"]["slug"]
