"""What each provider lifecycle event does to our own rows.

Every handler is a no-op when it cannot find the row the event refers to. Events for
rooms and egresses we never started are normal -- the provider emits them for everything
on the server -- so an unknown id is not an error to raise.
"""

import logging

from apps.vas_recordings import services
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


async def on_room_finished(event: ProviderEvent) -> None:
    await _set_session_status(event, VideoSession.Status.ENDED)


def register_default_handlers() -> None:
    registry.register("egress_started", on_egress_started)
    registry.register("egress_updated", on_egress_updated)
    registry.register("egress_ended", on_egress_ended)
    registry.register("room_started", on_room_started)
    registry.register("room_finished", on_room_finished)
