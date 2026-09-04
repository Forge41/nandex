import time

import pytest

from apps.tps.handlers import HANDLER_REGISTRY
from apps.tps.models import Connector


class StubOAuthHandler:
    """A minimal OAuthHandler double — no real network calls."""

    refresh_calls = 0

    def get_app_name(self) -> str:
        return "stubapp"

    async def get_user_info(self, config: dict) -> dict:
        return {"login": "stub-user"}

    def get_authorize_url(
        self, redirect_uri: str, form_data: dict | None = None
    ) -> tuple[str, str]:
        return f"https://stub.example/authorize?state=orig&redirect_uri={redirect_uri}", "orig"

    async def exchange_code(
        self, code: str, redirect_uri: str, form_data: dict | None = None
    ) -> dict:
        return {"access_token": f"tok-for-{code}", "expires_at": time.time() + 3600}

    async def refresh_token(self, config: dict) -> dict:
        StubOAuthHandler.refresh_calls += 1
        return {**config, "access_token": "refreshed-token", "expires_at": time.time() + 3600}

    def is_token_expired(self, config: dict) -> bool:
        return False

    async def revoke_token(self, config: dict) -> None:
        pass


@pytest.fixture
def stub_handler():
    HANDLER_REGISTRY["stubapp"] = StubOAuthHandler
    StubOAuthHandler.refresh_calls = 0
    yield StubOAuthHandler
    del HANDLER_REGISTRY["stubapp"]


@pytest.fixture
def stub_connector(db, stub_handler):
    return Connector.objects.create(
        app_code=999,
        app_name="stubapp",
        display_name="Stub App",
        auth_type=1,  # AuthType.OAUTH2
        category=1,
        is_install_required=True,
        active=True,
    )
