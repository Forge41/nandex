"""tps models — the connector catalog and per-user connection records.

Scope is deliberately narrow: tps proves a Connection has a valid, refreshable token.
It owns no cursor or sync state and never writes RawDocument — that's apps.importer's job.
"""

import secrets

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


class AuthType(models.IntegerChoices):
    OAUTH2 = 1, "oauth2"
    API_KEY = 2, "api_key"
    BASIC_AUTH = 3, "basic_auth"
    FORM_BASED_OAUTH2 = 4, "form_based_oauth2"
    MTLS = 5, "mtls"


class AppCategory(models.IntegerChoices):
    SOURCE_CONTROL = 1, "source_control"
    HOSTING = 2, "hosting"
    DISTRIBUTION = 3, "distribution"
    COMING_SOON = 4, "coming_soon"


class AppProvider(models.IntegerChoices):
    NATIVE = 1, "native"


class Connector(models.Model):
    """The connector catalog — one row per third-party app tps can connect to."""

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    app_code = models.IntegerField(unique=True)  # stable integer id: 1=GitHub, ...
    app_name = models.CharField(unique=True, db_index=True, max_length=64)  # slug: "github"
    display_name = models.CharField(max_length=128)
    auth_type = models.IntegerField(choices=AuthType.choices)
    category = models.IntegerField(choices=AppCategory.choices)
    provider = models.IntegerField(choices=AppProvider.choices, default=AppProvider.NATIVE)
    meta = models.JSONField(default=dict)  # icon, description, form_fields, keywords
    is_install_required = models.BooleanField(default=True)  # True=OAuth redirect, False=form
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tps_connector"

    def __str__(self) -> str:
        return self.app_name


class Connection(models.Model):
    """A project's credentials for one connector. Encrypted at rest, never mutated in place
    except by refresh (new token) or revoke (wipe).

    project_id is a plain id, not a Django ForeignKey to apps.core.Project — cross-app
    references stay plain ids throughout this codebase so apps don't import each other's
    models directly (see apps.importer.SyncRun.connection_id for the same convention).
    """

    class Status(models.TextChoices):
        ACTIVE = "active", "active"
        REVOKED = "revoked", "revoked"
        REAUTH_REQUIRED = "reauth_required", "reauth_required"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    project_id = models.CharField(db_index=True, max_length=24)
    connector = models.ForeignKey(Connector, on_delete=models.CASCADE, db_index=True)
    app_name = models.CharField(db_index=True, max_length=64)  # denormalized for quick lookups
    config_encrypted = models.TextField()  # MultiFernet ciphertext
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.ACTIVE)
    identifier = models.CharField(
        max_length=256, blank=True, default=""
    )  # github login, email, ...
    expires_at = models.FloatField(
        null=True, blank=True
    )  # unix timestamp, plaintext for fast checks
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tps_connection"

    def __str__(self) -> str:
        return f"{self.app_name}:{self.project_id}"
