"""Core domain: users, workspaces, projects — the base every other app depends on.

No Session model here: django.contrib.sessions already provides server-side, cookie-backed
sessions with rolling expiry. Auth is email-only (magic link), so User has no usable password.
"""

import secrets

from django.contrib.auth.base_user import AbstractBaseUser, BaseUserManager
from django.contrib.auth.models import PermissionsMixin
from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, **extra_fields) -> "User":
        if not email:
            raise ValueError("User must have an email")
        user = self.model(email=self.normalize_email(email), **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_user(self, email: str, **extra_fields) -> "User":
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields) -> "User":
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        user = self._create_user(email, **extra_fields)
        if password:
            user.set_password(password)
            user.save(using=self._db)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    name = models.CharField(max_length=256, blank=True, default="")
    email_verified = models.BooleanField(default=False)
    is_staff = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ()

    class Meta:
        db_table = "core_user"

    def __str__(self) -> str:
        return self.email


class Workspace(models.Model):
    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    name = models.CharField(max_length=256)
    slug = models.SlugField(unique=True, max_length=64)
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="owned_workspaces")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_workspace"

    def __str__(self) -> str:
        return self.slug


class WorkspaceMember(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "owner"
        MEMBER = "member", "member"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="members")
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.OWNER)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_workspace_member"
        constraints = (
            models.UniqueConstraint(fields=["workspace", "user"], name="uniq_workspace_member"),
        )

    def __str__(self) -> str:
        return f"{self.user_id}@{self.workspace_id}"


class Project(models.Model):
    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=256)
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "core_project"

    def __str__(self) -> str:
        return self.name
