"""De-duplication is the whole point of the event log: providers retry, so the same
event arriving three times must run the handlers exactly once.
"""

import pytest

from apps.vas_recordings.providers.base import ProviderEvent
from apps.vas_webhooks import services
from apps.vas_webhooks.models import WebhookLog
from apps.vas_webhooks.registry import registry

pytestmark = pytest.mark.django_db(transaction=True)

EVENT = ProviderEvent(event_id="ev-1", event_type="room_started", room_name="interview-iv-1")


class StubValidator:
    """Accepts one exact byte string. Nothing else verifies, which is what makes the
    raw-bytes test below meaningful."""

    def __init__(self, accepted: bytes) -> None:
        self._accepted = accepted

    def validate_and_parse(self, raw_body: bytes, auth_header: str) -> ProviderEvent:
        if raw_body != self._accepted:
            raise ValueError("Signature does not match these bytes")
        return EVENT


@pytest.fixture
def stub_validator(monkeypatch):
    validator = StubValidator(b'{"a":1,"b":2}')
    monkeypatch.setattr("apps.vas_webhooks.services.get_webhook_validator", lambda: validator)
    return validator


@pytest.fixture
def counting_registry(monkeypatch):
    calls: list[str] = []

    async def handler(event: ProviderEvent) -> None:
        calls.append(event.event_id)

    monkeypatch.setattr(registry, "_handlers", {"room_started": [handler]})
    return calls


async def test_the_same_event_delivered_three_times_runs_handlers_once(
    stub_validator, counting_registry
):
    for _ in range(3):
        await services.handle_event(b'{"a":1,"b":2}', "Bearer whatever")

    assert counting_registry == ["ev-1"]
    assert await WebhookLog.objects.filter(event_id="ev-1").acount() == 1


async def test_a_processed_event_is_recorded_as_processed(stub_validator, counting_registry):
    await services.handle_event(b'{"a":1,"b":2}', "Bearer whatever")

    log = await WebhookLog.objects.aget(event_id="ev-1")
    assert log.processed is True
    assert log.processing_error == ""
    assert log.room_name == "interview-iv-1"


async def test_a_semantically_identical_but_reserialized_body_is_rejected(
    stub_validator, counting_registry
):
    """The signature covers the exact bytes emitted; json.dumps of the parsed dict
    differs in key order and separator whitespace, so verifying a re-serialized body
    would verify something the provider never signed."""
    with pytest.raises(ValueError):
        await services.handle_event(b'{"b": 2, "a": 1}', "Bearer whatever")

    assert counting_registry == []
    assert await WebhookLog.objects.acount() == 0


async def test_a_failing_handler_records_the_error_and_re_raises(stub_validator, monkeypatch):
    async def exploding_handler(event: ProviderEvent) -> None:
        raise RuntimeError("handler blew up")

    monkeypatch.setattr(registry, "_handlers", {"room_started": [exploding_handler]})

    with pytest.raises(RuntimeError):
        await services.handle_event(b'{"a":1,"b":2}', "Bearer whatever")

    log = await WebhookLog.objects.aget(event_id="ev-1")
    assert log.processed is False
    assert "handler blew up" in log.processing_error
