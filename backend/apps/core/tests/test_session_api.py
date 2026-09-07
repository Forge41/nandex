import json

import pytest
from django.test import Client


@pytest.mark.django_db
def test_session_requires_auth():
    resp = Client().get("/auth/session")
    assert resp.status_code == 401


@pytest.mark.django_db
def test_session_returns_user_and_workspace(logged_in_client):
    resp = logged_in_client.get("/auth/session")
    assert resp.status_code == 200
    body = json.loads(resp.content)
    assert body["user"]["email"] == "dev@example.com"
    assert body["workspace"]["slug"]
