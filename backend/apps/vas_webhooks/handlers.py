"""What each provider lifecycle event does to our own rows.

Every handler is a no-op when it cannot find the row the event refers to. Events for
rooms and egresses we never started are normal -- the provider emits them for everything
on the server -- so an unknown id is not an error to raise.
"""

import logging

from apps.vas_recordings import services
from apps.vas_recordings.activities import post_event_to_main_backend
from apps.vas_recordings.models import Recording, VideoSession
from apps.vas_recordings.providers.base import FileInfo, ProviderEvent
from apps.vas_webhooks.registry import registry

logger = logging.getLogger(__name__)


async def _recording_for(event: ProviderEvent) -> Recording | None:
    if not event.egress_id:
        return None
    return await Recording.objects.filter(egress_id=event.egress_id).afirst()


async def on_egress_started(event: ProviderEvent) -> None:
    recording = await _recording_for(event)
    if recording is None:
        return
    recording.status = Recording.Status.ACTIVE
    await recording.asave(update_fields=["status", "updated_at"])


async def on_egress_updated(event: ProviderEvent) -> None:
    recording = await _recording_for(event)
    if recording is None or event.egress_result is None:
        return
    recording.status = event.egress_result.status
    await recording.asave(update_fields=["status", "updated_at"])


async def on_egress_ended(event: ProviderEvent) -> None:
    recording = await _recording_for(event)
    if recording is None:
        logger.warning("egress_ended for unknown egress %s", event.egress_id)
        return

    result = event.egress_result
    if result and result.error:
        await services.mark_failed(recording.id, result.error)
        logger.warning("Recording %s failed: %s", event.egress_id, result.error)
        return

    # Egress can end without file results; the object key we chose at start is still the
    # right path, so completion is recorded against it rather than skipped.
    file_info = (result.file_info if result else None) or FileInfo(
        storage_path=recording.gcs_object_key, duration_seconds=0.0, file_size_bytes=0
    )
    await services.mark_complete(recording.id, file_info)

    from apps.vas_recordings.workflows import trigger_notify_main_backend

    await trigger_notify_main_backend(recording.id)


async def _set_session_status(event: ProviderEvent, status: str) -> None:
    if not event.room_name:
        return
    # Looked up by room_name, not by stripping a prefix off it: the caller chooses the
    # name now, so we have no prefix to assume.
    session = await VideoSession.objects.filter(room_name=event.room_name).afirst()
    if session is None:
        return
    session.status = status
    await session.asave(update_fields=["status", "updated_at"])


async def on_room_started(event: ProviderEvent) -> None:
    await _set_session_status(event, VideoSession.Status.ACTIVE)

    if not event.room_name:
        return
    session = await VideoSession.objects.filter(
        room_name=event.room_name, auto_record=True
    ).afirst()
    if session is None:
        return
    try:
        await services.start_recording(session.id, "speaker", False)
    except services.VasError:
        # Already recording is the common case on a reconnect, and a genuine failure must
        # not fail the webhook -- a 5xx makes the provider retry the whole event.
        logger.warning("Couldn't auto-start recording for room %s", event.room_name, exc_info=True)


async def on_room_finished(event: ProviderEvent) -> None:
    await _set_session_status(event, VideoSession.Status.ENDED)
    await _tell_the_main_backend(event)


async def _tell_the_main_backend(event: ProviderEvent) -> None:
    """The room emptying is what the caller cannot observe for itself.

    A browser's "I am leaving" is unacknowledged and does not fire for every way of
    leaving; this does, and only after the provider's own empty timeout, so a candidate
    who reconnects has already had their chance. Posted directly rather than through a
    workflow: the caller has its own backstop for a session nobody ends, so a failure
    here is a delay and not a loss -- but it is a real gap, so it is logged as one.
    """
    if not event.room_name:
        return
    session = await VideoSession.objects.filter(room_name=event.room_name).afirst()
    if session is None or not session.external_session_id:
        return
    try:
        await post_event_to_main_backend(
            {
                "event": "session.room_finished",
                "external_session_id": session.external_session_id,
                "vas_session_id": session.id,
            }
        )
    except Exception:
        logger.warning(
            "Couldn't tell the main backend room %s finished", event.room_name, exc_info=True
        )


def register_default_handlers() -> None:
    registry.register("egress_started", on_egress_started)
    registry.register("egress_updated", on_egress_updated)
    registry.register("egress_ended", on_egress_ended)
    registry.register("room_started", on_room_started)
    registry.register("room_finished", on_room_finished)
