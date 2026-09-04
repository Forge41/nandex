"""Magic-link auth — find/create user, ensure a default workspace+project, log in.

Session creation itself is django.contrib.auth.login(); there's no custom Session model.
"""

import re

from django.conf import settings
from django.contrib.auth import login, logout
from django.core.mail import send_mail
from django.http import HttpRequest

from apps.core.auth.magic_link import create_magic_token, verify_magic_token
from apps.core.models import Project, User, Workspace, WorkspaceMember

MAGIC_LINK_MAX_AGE = 15 * 60


def request_magic_link(email: str) -> None:
    """Always succeeds — never reveal whether the email is registered."""
    token = create_magic_token(email)
    link = f"{settings.APP_URL}/auth/verify?token={token}"
    send_mail(
        subject="Your sign-in link",
        message=f"Sign in here: {link}",
        from_email=None,
        recipient_list=[email],
    )


def verify_and_login(request: HttpRequest, token: str) -> tuple[User, Workspace, bool]:
    """Verify a magic link token, ensure a workspace+project exist, and log in.

    Returns (user, workspace, is_new_user).
    """
    email = verify_magic_token(token, MAGIC_LINK_MAX_AGE)
    if not email:
        raise ValueError("Invalid or expired magic link")

    user, is_new_user = User.objects.get_or_create(email=email)
    if not user.email_verified:
        user.email_verified = True
        user.save(update_fields=["email_verified"])

    workspace = Workspace.objects.filter(members__user=user).first()
    if workspace is None:
        slug = _generate_slug(email, user.id)
        workspace = Workspace.objects.create(name=f"{slug}'s workspace", slug=slug, owner=user)
        WorkspaceMember.objects.create(
            workspace=workspace, user=user, role=WorkspaceMember.Role.OWNER
        )
        Project.objects.create(
            workspace=workspace, name="Default", description="Your first project"
        )

    user.backend = "django.contrib.auth.backends.ModelBackend"
    login(request, user)

    return user, workspace, is_new_user


def logout_current(request: HttpRequest) -> None:
    logout(request)


def _generate_slug(email: str, user_id: str) -> str:
    local = email.split("@")[0]
    slug = re.sub(r"[^a-z0-9-]", "-", local.lower())[:20]
    return f"{slug}-{user_id[:6]}"
