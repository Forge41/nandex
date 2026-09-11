"""The retry and error-translation behaviour, which is where a browser-facing failure
gets its shape: a 409 from vas has to stay a 409, and vas's internal detail text must
never reach a candidate.
"""

import httpx
import pytest

from apps.core.clients import vas_client


class FakeAsyncClient:
    """Stands in for httpx.AsyncClient, which the client constructs per call. Each queued
    entry is either a Response to return or an exception to raise."""

    def __init__(self, script: list) -> None:
        self._script = script
        self.calls: list[tuple[str, str]] = []

    def __call__(self, *args, **kwargs):
        return self

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    async def request(self, method, url, **kwargs):
        self.calls.append((method, url))
        outcome = self._script.pop(0) if self._script else httpx.Response(200, json={})
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


@pytest.fixture
def no_sleep(monkeypatch):
    """The backoff is real time; the test asserts attempt counts, not wall clock."""

    async def instant(_seconds):
        return None

    monkeypatch.setattr(vas_client.asyncio, "sleep", instant)


def _install(monkeypatch, script: list) -> FakeAsyncClient:
    fake = FakeAsyncClient(script)
    monkeypatch.setattr(vas_client.httpx, "AsyncClient", fake)
    monkeypatch.setattr(vas_client.settings, "vas_base_url", "http://vas.test")
    monkeypatch.setattr(vas_client.settings, "vas_service_bearer_token", "test-bearer")
    return fake


async def test_a_successful_call_returns_the_decoded_body(monkeypatch, no_sleep):
    fake = _install(monkeypatch, [httpx.Response(201, json={"id": "vs1", "status": "created"})])

    result = await vas_client.register_session("iv-1", "interview-iv-1")

    assert result == {"id": "vs1", "status": "created"}
    assert fake.calls == [("POST", "http://vas.test/video/sessions")]


async def test_a_transport_error_is_retried_up_to_three_times(monkeypatch, no_sleep):
    fake = _install(
        monkeypatch,
        [httpx.ConnectError("refused"), httpx.ConnectError("refused"), httpx.ConnectError("refused")],
    )

    with pytest.raises(vas_client.VasUnavailable):
        await vas_client.get_session("vs1")

    assert len(fake.calls) == vas_client.MAX_ATTEMPTS


async def test_a_transport_error_that_recovers_returns_the_later_success(monkeypatch, no_sleep):
    fake = _install(
        monkeypatch, [httpx.ConnectError("refused"), httpx.Response(200, json={"id": "vs1"})]
    )

    assert await vas_client.get_session("vs1") == {"id": "vs1"}
    assert len(fake.calls) == 2


async def test_a_5xx_is_retried(monkeypatch, no_sleep):
    fake = _install(
        monkeypatch,
        [httpx.Response(503, text="upstream down"), httpx.Response(200, json={"id": "vs1"})],
    )

    assert await vas_client.get_session("vs1") == {"id": "vs1"}
    assert len(fake.calls) == 2


async def test_a_4xx_is_not_retried_and_keeps_its_status(monkeypatch, no_sleep):
    """Retrying a 409 just repeats the same rejection, and the status is information the
    caller needs: it really does mean a recording is already running."""
    fake = _install(
        monkeypatch, [httpx.Response(409, json={"detail": "Recording EG_1 is already active"})]
    )

    with pytest.raises(vas_client.VasError) as exc_info:
        await vas_client.start_recording("vs1")

    assert exc_info.value.status == 409
    assert len(fake.calls) == 1


async def test_a_persistent_5xx_never_leaks_vas_internals(monkeypatch, no_sleep):
    """The message reaches a browser, so it must not describe vas's internal state."""
    _install(monkeypatch, [httpx.Response(500, text="Traceback: psycopg OperationalError at vas_recording")] * 3)

    with pytest.raises(vas_client.VasUnavailable) as exc_info:
        await vas_client.stop_recording("vs1")

    assert str(exc_info.value) == "Video service unavailable"
    assert "psycopg" not in str(exc_info.value)


async def test_a_non_json_body_is_unavailable_rather_than_a_crash(monkeypatch, no_sleep):
    _install(monkeypatch, [httpx.Response(200, text="<html>nginx 502</html>")])

    with pytest.raises(vas_client.VasUnavailable):
        await vas_client.get_session("vs1")


async def test_an_error_without_a_detail_field_still_produces_a_message(monkeypatch, no_sleep):
    _install(monkeypatch, [httpx.Response(404, json={})])

    with pytest.raises(vas_client.VasError) as exc_info:
        await vas_client.get_session("vs1")

    assert exc_info.value.status == 404
    assert exc_info.value.detail


async def test_the_bearer_token_is_sent(monkeypatch, no_sleep):
    _install(monkeypatch, [httpx.Response(200, json={})])
    headers = vas_client._headers()

    assert headers["Authorization"] == "Bearer test-bearer"


async def test_playback_url_only_sends_a_recording_id_when_given_one(monkeypatch, no_sleep):
    captured = {}

    class Capturing(FakeAsyncClient):
        async def request(self, method, url, **kwargs):
            captured["params"] = kwargs.get("params")
            return httpx.Response(200, json={"url": "https://x"})

    fake = Capturing([])
    monkeypatch.setattr(vas_client.httpx, "AsyncClient", fake)
    monkeypatch.setattr(vas_client.settings, "vas_base_url", "http://vas.test")

    await vas_client.playback_url("vs1")
    assert captured["params"] is None

    await vas_client.playback_url("vs1", "r1")
    assert captured["params"] == {"recording_id": "r1"}
