"""Exercises GoogleDriveProviderAdapter's real HTTP request/response handling and error
mapping via httpx.MockTransport — no network calls.
"""

import httpx
import pytest

from apps.importer.errors import (
    AuthExpiredError,
    PermanentProviderError,
    RateLimitedError,
    TransientProviderError,
)
from apps.importer.providers.base import ItemRef
from apps.importer.providers.google_drive import (
    GoogleDriveProviderAdapter,
    _raise_for_error_response,
)

_RealAsyncClient = httpx.AsyncClient


def _mock_client(handler_fn):
    return _RealAsyncClient(transport=httpx.MockTransport(handler_fn))


@pytest.mark.asyncio
async def test_list_page_parses_files_and_next_cursor(monkeypatch):
    def handle(request: httpx.Request) -> httpx.Response:
        assert "corpora=allDrives" in str(request.url)
        return httpx.Response(
            200,
            json={
                "nextPageToken": "next",
                "files": [
                    {
                        "id": "f1",
                        "name": "One",
                        "mimeType": "text/plain",
                        "modifiedTime": "t1",
                        "size": "10",
                    },
                    {
                        "id": "f2",
                        "name": "Two",
                        "mimeType": "application/vnd.google-apps.document",
                        "modifiedTime": "t2",
                    },
                ],
            },
        )

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _mock_client(handle))

    adapter = GoogleDriveProviderAdapter()
    page = await adapter.list_page("tok", None)

    assert page.next_cursor == "next"
    assert page.items == [
        ItemRef(id="f1", name="One", mime_type="text/plain", version="t1", size=10),
        ItemRef(
            id="f2",
            name="Two",
            mime_type="application/vnd.google-apps.document",
            version="t2",
            size=None,
        ),
    ]


@pytest.mark.asyncio
async def test_download_item_exports_native_google_doc(monkeypatch):
    def handle(request: httpx.Request) -> httpx.Response:
        assert "/export" in str(request.url)
        assert "wordprocessingml" in request.url.params["mimeType"]
        return httpx.Response(200, content=b"docx-bytes")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _mock_client(handle))

    item = ItemRef(
        id="f2", name="Doc", mime_type="application/vnd.google-apps.document", version="t2"
    )
    adapter = GoogleDriveProviderAdapter()
    downloaded = await adapter.download_item("tok", item)

    assert downloaded.payload == b"docx-bytes"
    assert "wordprocessingml" in downloaded.content_type


@pytest.mark.asyncio
async def test_download_item_plain_get_for_binary_file(monkeypatch):
    def handle(request: httpx.Request) -> httpx.Response:
        assert "/export" not in str(request.url)
        assert request.url.params["alt"] == "media"
        return httpx.Response(200, content=b"raw-bytes")

    monkeypatch.setattr(httpx, "AsyncClient", lambda **kw: _mock_client(handle))

    item = ItemRef(id="f1", name="File", mime_type="application/pdf", version="t1")
    adapter = GoogleDriveProviderAdapter()
    downloaded = await adapter.download_item("tok", item)

    assert downloaded.payload == b"raw-bytes"
    assert downloaded.content_type == "application/pdf"


@pytest.mark.asyncio
async def test_download_item_over_size_limit_raises_permanent_without_a_request():
    item = ItemRef(
        id="f1", name="Huge", mime_type="application/pdf", version="t1", size=999_999_999
    )
    adapter = GoogleDriveProviderAdapter()
    with pytest.raises(PermanentProviderError, match="over the"):
        await adapter.download_item("tok", item)


# The mapping logic itself is tested directly against _raise_for_error_response, not
# through list_page/download_item — those go through _get, which tenacity wraps with
# real retries/sleeps for TransientProviderError and RateLimitedError; going through the
# full stack here would mean multiple real-time backoff sleeps per test (the 429 case
# with Retry-After: 42 would sleep a genuine 42 real seconds, repeatedly).


def test_401_maps_to_auth_expired():
    with pytest.raises(AuthExpiredError):
        _raise_for_error_response(httpx.Response(401, json={}))


def test_403_quota_reason_maps_to_rate_limited_not_permanent():
    response = httpx.Response(
        403, json={"error": {"errors": [{"reason": "userRateLimitExceeded"}]}}
    )
    with pytest.raises(RateLimitedError):
        _raise_for_error_response(response)


def test_403_permission_reason_maps_to_permanent_not_rate_limited():
    response = httpx.Response(
        403, json={"error": {"errors": [{"reason": "insufficientFilePermissions"}]}}
    )
    with pytest.raises(PermanentProviderError):
        _raise_for_error_response(response)


def test_429_carries_retry_after():
    response = httpx.Response(429, json={}, headers={"Retry-After": "42"})
    with pytest.raises(RateLimitedError) as exc_info:
        _raise_for_error_response(response)
    assert exc_info.value.retry_after == 42.0


def test_404_maps_to_permanent_not_transient():
    with pytest.raises(PermanentProviderError):
        _raise_for_error_response(httpx.Response(404, json={}))


def test_5xx_is_transient():
    with pytest.raises(TransientProviderError):
        _raise_for_error_response(httpx.Response(503, json={}))


def test_2xx_does_not_raise():
    _raise_for_error_response(httpx.Response(200, json={}))  # must not raise
