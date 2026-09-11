import pytest


@pytest.fixture
def capture_notifications(monkeypatch):
    """Collects the recording ids a handler would notify the main backend about, without
    reaching Temporal."""
    notified: list[str] = []

    async def fake_trigger(recording_id: str) -> None:
        notified.append(recording_id)

    monkeypatch.setattr("apps.vas_recordings.workflows.trigger_notify_main_backend", fake_trigger)
    return notified
