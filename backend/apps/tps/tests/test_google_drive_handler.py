"""Exercises GoogleDriveHandler's real HTTP request/response handling via
httpx.MockTransport — no network calls, but real request construction and JSON parsing.
"""

import time

import httpx
import pytest

from apps.tps.config import settings
from apps.tps.handlers.google_drive import GoogleDriveHandler

_RealAsyncClient = httpx.AsyncClient


def _mock_client(handler_fn):
    """Returns a real AsyncClient wired to a MockTransport — must use the captured
    _RealAsyncClient, not httpx.AsyncClient, since tests monkeypatch that name."""
    return _RealAsyncClient(transport=httpx.MockTransport(handler_fn))


@pytest.fixture(autouse=True)
def _google_creds():
    settings.google_drive_client_id = "test-client-id"
    settings.google_drive_client_secret = "test-client-secret"


def test_get_authorize_url_requests_offline_access_and_consent():
    handler = GoogleDriveHandler()
    url, state = handler.get_authorize_url("http://localhost:3000/callback")

    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "client_id=test-client-id" in url
    assert f"state={state}" in url


@pytest.mark.asyncio
async def test_exchange_code_returns_config_with_expires_at(monkeypatch):
    def handle(request: httpx.Request) -> httpx.Response:
        assert request.url.path == "/token"
        body = dict(x.split("=") for x in request.content.decode().split("&"))
        assert body["grant_type"] == "authorization_code"
        assert body["code"] == "auth-code-123"
        return httpx.Response(
            200,
            json={
                "access_token": "access-abc",
                "refresh_token": "refresh-abc",
                "expires_in": 3600,
                "token_type": "Bearer",
                "scope": "openid email",
            },
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _mock_client(handle))

    handler = GoogleDriveHandler()
    before = time.time()
    config = await handler.exchange_code("auth-code-123", "http://localhost:3000/callback")

    assert config["access_token"] == "access-abc"
    assert config["refresh_token"] == "refresh-abc"
    assert config["expires_at"] > before


@pytest.mark.asyncio
async def test_exchange_code_raises_on_oauth_error(monkeypatch):
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_grant", "error_description": "bad code"})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _mock_client(handle))

    handler = GoogleDriveHandler()
    with pytest.raises(ValueError, match="bad code"):
        await handler.exchange_code("bad-code", "http://localhost:3000/callback")


@pytest.mark.asyncio
async def test_refresh_token_keeps_old_refresh_token_when_not_rotated(monkeypatch):
    def handle(request: httpx.Request) -> httpx.Response:
        body = dict(x.split("=") for x in request.content.decode().split("&"))
        assert body["grant_type"] == "refresh_token"
        assert body["refresh_token"] == "existing-refresh"
        return httpx.Response(200, json={"access_token": "new-access", "expires_in": 3600})

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _mock_client(handle))

    handler = GoogleDriveHandler()
    config = await handler.refresh_token(
        {"access_token": "old", "refresh_token": "existing-refresh"}
    )

    assert config["access_token"] == "new-access"
    assert config["refresh_token"] == "existing-refresh"


@pytest.mark.asyncio
async def test_refresh_token_without_stored_refresh_token_raises():
    handler = GoogleDriveHandler()
    with pytest.raises(ValueError, match="reconnect"):
        await handler.refresh_token({"access_token": "old"})


def test_is_token_expired_true_when_no_expires_at():
    handler = GoogleDriveHandler()
    assert handler.is_token_expired({}) is True


def test_is_token_expired_false_when_in_future():
    handler = GoogleDriveHandler()
    assert handler.is_token_expired({"expires_at": time.time() + 3600}) is False


@pytest.mark.asyncio
async def test_revoke_token_is_best_effort_on_network_failure(monkeypatch):
    class FailingTransport(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request):
            raise httpx.ConnectError("boom")

    monkeypatch.setattr(
        httpx, "AsyncClient", lambda **kw: _RealAsyncClient(transport=FailingTransport())
    )

    handler = GoogleDriveHandler()
    await handler.revoke_token({"access_token": "tok"})  # must not raise


@pytest.mark.asyncio
async def test_revoke_token_noop_without_access_token():
    handler = GoogleDriveHandler()
    await handler.revoke_token({})  # must not raise, must not make a request


@pytest.mark.asyncio
async def test_get_user_info_maps_userinfo_response(monkeypatch):
    def handle(request: httpx.Request) -> httpx.Response:
        assert request.headers["Authorization"] == "Bearer tok"
        return httpx.Response(
            200, json={"sub": "123", "email": "dev@example.com", "name": "Dev User"}
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _mock_client(handle))

    handler = GoogleDriveHandler()
    info = await handler.get_user_info({"access_token": "tok"})

    assert info == {"id": "123", "email": "dev@example.com", "name": "Dev User"}
