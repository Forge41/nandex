"""Ported from the upstream service's webhook suite.

An event for a room or egress we never started is normal -- the provider emits events
for everything on the server -- so every handler must be a no-op on an unknown id rather
than raise.
"""

import pytest

from apps.vas_recordings.models import Recording, VideoSession
from apps.vas_recordings.providers.base import EgressResult, EgressStatus, FileInfo, ProviderEvent
from apps.vas_webhooks import handlers
from apps.vas_webhooks.registry import WebhookRegistry

pytestmark = pytest.mark.django_db(transaction=True)


def _event(event_type: str, *, egress_id: str = "", room_name: str = "", result=None):
    return ProviderEvent(
        event_id=f"ev-{event_type}-{egress_id or room_name}",
        event_type=event_type,
        room_name=room_name,
        egress_id=egress_id,
        egress_result=result,
    )


async def _session_with_recording(status=Recording.Status.STARTING):
    session = await VideoSession.objects.acreate(
        external_session_id="iv-1", room_name="interview-iv-1"
    )
    recording = await Recording.objects.acreate(
        session=session,
        egress_id="eg-1",
        status=status,
        gcs_bucket="test-bucket",
        gcs_object_key="recordings/iv-1/1.mp4",
    )
    return session, recording


async def test_egress_started_makes_the_recording_active():
    _, recording = await _session_with_recording()
    await handlers.on_egress_started(_event("egress_started", egress_id="eg-1"))

    await recording.arefresh_from_db()
    assert recording.status == Recording.Status.ACTIVE


async def test_egress_started_for_an_unknown_egress_is_a_noop(db):
    await handlers.on_egress_started(_event("egress_started", egress_id="eg-unknown"))


async def test_egress_ended_records_the_file_details_and_notifies(capture_notifications):
    notified = capture_notifications
    _, recording = await _session_with_recording(Recording.Status.ENDING)

    result = EgressResult(
        egress_id="eg-1",
        status=EgressStatus.COMPLETE,
        file_info=FileInfo(
            storage_path="recordings/iv-1/1.mp4",
            duration_seconds=120.0,
            file_size_bytes=1024,
        ),
    )
    await handlers.on_egress_ended(_event("egress_ended", egress_id="eg-1", result=result))

    await recording.arefresh_from_db()
    assert recording.status == Recording.Status.COMPLETE
    assert recording.duration_seconds == 120.0
    assert recording.file_size_bytes == 1024
    assert notified == [recording.id]


async def test_egress_ended_with_an_error_marks_it_failed_and_does_not_notify(
    capture_notifications,
):
    notified = capture_notifications
    _, recording = await _session_with_recording(Recording.Status.ENDING)

    result = EgressResult(egress_id="eg-1", status=EgressStatus.FAILED, error="ffmpeg crash")
    await handlers.on_egress_ended(_event("egress_ended", egress_id="eg-1", result=result))

    await recording.arefresh_from_db()
    assert recording.status == Recording.Status.FAILED
    assert recording.failure_reason == "ffmpeg crash"
    assert notified == []


async def test_egress_ended_with_no_file_results_still_completes(capture_notifications):
    """The object key chosen at start is still the right path, so completion is recorded
    against it rather than skipped."""
    _, recording = await _session_with_recording(Recording.Status.ENDING)

    result = EgressResult(egress_id="eg-1", status=EgressStatus.COMPLETE)
    await handlers.on_egress_ended(_event("egress_ended", egress_id="eg-1", result=result))

    await recording.arefresh_from_db()
    assert recording.status == Recording.Status.COMPLETE
    assert recording.gcs_object_key == "recordings/iv-1/1.mp4"


async def test_room_lifecycle_events_move_the_session_by_room_name():
    """Looked up by room_name rather than by stripping a prefix off it: the caller owns
    the naming now, so there is no prefix to assume."""
    session, _ = await _session_with_recording()

    await handlers.on_room_started(_event("room_started", room_name="interview-iv-1"))
    await session.arefresh_from_db()
    assert session.status == VideoSession.Status.ACTIVE

    await handlers.on_room_finished(_event("room_finished", room_name="interview-iv-1"))
    await session.arefresh_from_db()
    assert session.status == VideoSession.Status.ENDED


async def test_room_events_for_a_room_we_do_not_own_are_ignored():
    session, _ = await _session_with_recording()
    await handlers.on_room_started(_event("room_started", room_name="someone-elses-room"))

    await session.arefresh_from_db()
    assert session.status == VideoSession.Status.CREATED


async def test_room_event_with_no_room_name_is_a_noop(db):
    await handlers.on_room_started(_event("room_started"))


async def test_registry_dispatches_to_every_handler_for_an_event_type():
    calls = []

    async def handler(event):
        calls.append(event.event_id)

    registry = WebhookRegistry()
    registry.register("egress_started", handler)
    event = _event("egress_started", egress_id="eg-1")
    await registry.dispatch(event)

    assert calls == [event.event_id]


async def test_registry_warns_rather_than_raises_on_an_unknown_event(caplog):
    import logging

    registry = WebhookRegistry()
    with caplog.at_level(logging.WARNING):
        await registry.dispatch(_event("something_we_do_not_handle"))
    assert "No handler for webhook" in caplog.text
