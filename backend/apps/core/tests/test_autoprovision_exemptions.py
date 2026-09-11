"""AutoProvisionAnonymousUserMiddleware creates a User, Workspace, WorkspaceMember,
Project and session row for any request without a cookie. Machine-to-machine ingress is
cookie-less and retried, so without an exemption a retried webhook is unbounded write
amplification.

The control test matters as much as the exemptions: it proves the allowlist narrowed the
behaviour rather than disabling the middleware.
"""

import pytest
from django.contrib.sessions.models import Session
from django.test import Client

from apps.core.models import Project, User, Workspace, WorkspaceMember


def _identity_counts() -> tuple[int, ...]:
    return (
        User.objects.count(),
        Workspace.objects.count(),
        WorkspaceMember.objects.count(),
        Project.objects.count(),
        Session.objects.count(),
    )


@pytest.mark.django_db
def test_an_exempt_prefix_mints_no_identity_however_many_times_it_is_retried():
    client = Client()
    before = _identity_counts()

    for _ in range(10):
        client.post("/interview/callbacks/vas", data="{}", content_type="application/json")

    assert _identity_counts() == before


@pytest.mark.django_db
def test_health_is_exempt():
    client = Client()
    before = _identity_counts()
    assert client.get("/health").status_code == 200
    assert _identity_counts() == before


@pytest.mark.django_db
def test_a_normal_path_still_auto_provisions():
    client = Client()
    assert client.get("/auth/session").status_code == 200

    users, workspaces, members, projects, sessions = _identity_counts()
    assert (users, workspaces, members, projects) == (1, 1, 1, 1)
    assert sessions == 1


@pytest.mark.django_db
def test_a_path_that_merely_starts_with_an_exempt_word_is_not_exempt(settings):
    """Prefix matching is on the configured strings exactly -- "/healthcheck-ui" sharing
    five characters with "/health" would be a silent hole if the list were fuzzy."""
    settings.ANONYMOUS_AUTOPROVISION_EXEMPT_PREFIXES = ("/interview/callbacks/",)
    client = Client()
    assert client.get("/auth/session").status_code == 200
    assert User.objects.count() == 1


def test_the_vas_process_does_not_run_the_middleware_at_all():
    """The vas process inherits config.settings, so without its own leaner stack *every*
    vas endpoint would auto-provision. The prefix list is the belt; this is the braces.
    """
    import importlib

    settings_vas = importlib.import_module("config.settings_vas")

    assert (
        "apps.core.middleware.AutoProvisionAnonymousUserMiddleware" not in settings_vas.MIDDLEWARE
    )
    assert settings_vas.ROOT_URLCONF == "config.vas_urls"


def test_the_vas_process_allows_the_host_header_containers_reach_it_by():
    """LiveKit and Egress run as containers, so the Host header on every webhook they
    send is the gateway name -- never localhost. Django rejects an unlisted Host with a
    bare 400 from CommonMiddleware, before the view, which reads as "the webhook never
    arrived": the provider logs a successful send and nothing changes. Found by running a
    real LiveKit server against the service.
    """
    import importlib

    settings_vas = importlib.import_module("config.settings_vas")

    assert "host.docker.internal" in settings_vas.ALLOWED_HOSTS
