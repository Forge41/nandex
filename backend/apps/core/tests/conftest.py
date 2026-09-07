import re

import pytest
from django.core import mail
from django.test import Client


@pytest.fixture(autouse=True)
def _locmem_email(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"


@pytest.fixture
def logged_in_client(db) -> Client:
    client = Client()
    client.post("/auth/login", data={"email": "dev@example.com"}, content_type="application/json")
    token = re.search(r"token=(\S+)", mail.outbox[-1].body).group(1)
    resp = client.post("/auth/verify", data={"token": token}, content_type="application/json")
    assert resp.status_code == 200
    return client
