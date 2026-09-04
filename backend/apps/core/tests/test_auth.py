import pytest
from django.contrib.sessions.middleware import SessionMiddleware
from django.core import mail
from django.test import RequestFactory

from apps.core.auth.magic_link import create_magic_token, verify_magic_token
from apps.core.auth.service import request_magic_link, verify_and_login
from apps.core.models import Project, User, Workspace, WorkspaceMember


def _request_with_session():
    """login() needs request.session — a bare RequestFactory request has none."""
    request = RequestFactory().post("/auth/verify")
    SessionMiddleware(lambda r: None).process_request(request)
    request.session.save()
    return request


def test_magic_token_round_trips():
    token = create_magic_token("dev@example.com")
    assert verify_magic_token(token, max_age=900) == "dev@example.com"


def test_magic_token_rejects_tampering():
    token = create_magic_token("dev@example.com")
    assert verify_magic_token(token + "x", max_age=900) is None


def test_magic_token_rejects_expiry():
    token = create_magic_token("dev@example.com")
    assert verify_magic_token(token, max_age=0) is None


@pytest.mark.django_db
def test_request_magic_link_sends_email():
    request_magic_link("dev@example.com")
    assert len(mail.outbox) == 1
    assert "dev@example.com" in mail.outbox[0].to
    assert "token=" in mail.outbox[0].body


@pytest.mark.django_db
def test_verify_and_login_creates_user_workspace_and_default_project():
    token = create_magic_token("new@example.com")
    request = _request_with_session()

    user, workspace, is_new_user = verify_and_login(request, token)

    assert is_new_user is True
    assert User.objects.get(email="new@example.com") == user
    assert user.email_verified is True
    assert WorkspaceMember.objects.filter(workspace=workspace, user=user).exists()
    assert Project.objects.filter(workspace=workspace, name="Default").exists()


@pytest.mark.django_db
def test_verify_and_login_reuses_existing_workspace_on_second_login():
    email = "repeat@example.com"
    request = _request_with_session()

    _, workspace_one, is_new_first = verify_and_login(request, create_magic_token(email))
    _, workspace_two, is_new_second = verify_and_login(request, create_magic_token(email))

    assert is_new_first is True
    assert is_new_second is False
    assert workspace_one.id == workspace_two.id
    assert Workspace.objects.filter(owner__email=email).count() == 1


@pytest.mark.django_db
def test_verify_and_login_rejects_invalid_token():
    request = _request_with_session()
    with pytest.raises(ValueError):
        verify_and_login(request, "not-a-real-token")
