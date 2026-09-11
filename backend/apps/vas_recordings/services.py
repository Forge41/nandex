"""Session registration, recording control, and playback.

Every function here is async and reaches the ORM through sync_to_async, because the
provider calls beside them are native coroutines.
"""

import logging
import time

from asgiref.sync import sync_to_async
from django.utils import timezone

from apps.vas_recordings.config import settings
from apps.vas_recordings.models import Recording, VideoSession
from apps.vas_recordings.providers import get_egress_provider, get_storage_provider
from apps.vas_recordings.providers.base import FileInfo, RecordingOptions

logger = logging.getLogger(__name__)


class VasError(Exception):
    """Carries the HTTP status the caller should see, so views stay a dispatch table
    rather than a chain of except clauses per failure mode."""

    status = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class SessionNotFound(VasError):
    status = 404


class RecordingNotFound(VasError):
    status = 404


class RecordingAlreadyActive(VasError):
    status = 409


class RecordingNotComplete(VasError):
    status = 409


class RecordingNotYetInStorage(VasError):
    status = 409


class RecordingInFlight(VasError):
    status = 409


async def register_session(
    external_session_id: str, room_name: str, metadata: dict
) -> VideoSession:
    """Idempotent on external_session_id, which is what makes lazy provisioning safe to
    call on every token mint.

    The room name is the caller's: tps signs join tokens against it, so deriving one here
    would put two authorities on the same string.
    """
    existing = await VideoSession.objects.filter(external_session_id=external_session_id).afirst()
    if existing is not None:
        return existing
    return await VideoSession.objects.acreate(
        external_session_id=external_session_id, room_name=room_name, metadata=metadata
    )


async def get_session(session_id: str) -> VideoSession:
    session = await VideoSession.objects.filter(id=session_id).afirst()
    if session is None:
        raise SessionNotFound("Session not found")
    return session


async def start_recording(session_id: str, layout: str, audio_only: bool) -> Recording:
    session = await get_session(session_id)

    active = await Recording.objects.filter(
        session=session, status__in=Recording.IN_FLIGHT_STATUSES
    ).afirst()
    if active is not None:
        raise RecordingAlreadyActive(f"Recording {active.egress_id} is already {active.status}")

    storage = get_storage_provider()
    object_key = f"recordings/{session.id}/{int(time.time())}.mp4"
    upload = storage.upload_config(object_key)

    result = await get_egress_provider().start_recording(
        session.room_name,
        RecordingOptions(
            storage_path=object_key,
            storage_config=upload,
            layout=layout,
            audio_only=audio_only,
        ),
    )

    recording = await Recording.objects.acreate(
        session=session,
        egress_id=result.egress_id,
        gcs_bucket=upload.bucket,
        gcs_object_key=object_key,
    )
    logger.info("Started recording %s for session %s", result.egress_id, session.id)
    return recording


async def stop_recording(session_id: str, recording_id: str | None) -> Recording:
    session = await get_session(session_id)

    query = Recording.objects.filter(session=session)
    if recording_id:
        recording = await query.filter(id=recording_id).afirst()
        if recording is None:
            raise RecordingNotFound("Recording not found")
    else:
        recording = await query.filter(status__in=Recording.IN_FLIGHT_STATUSES).afirst()

    if recording is None:
        # Stopping is idempotent: a caller that stops twice, or stops after Egress
        # finalized on its own when the last participant left, gets the last recording
        # back rather than an error it cannot act on.
        recording = await query.order_by("-created_at").afirst()
        if recording is None:
            raise RecordingNotFound("No recording for this session")
        return recording

    if recording.status not in Recording.IN_FLIGHT_STATUSES:
        return recording

    await get_egress_provider().stop_recording(recording.egress_id)
    recording.status = Recording.Status.ENDING
    await recording.asave(update_fields=["status", "updated_at"])
    logger.info("Stopping recording %s for session %s", recording.egress_id, session.id)
    return recording


async def list_recordings(session_id: str) -> list[Recording]:
    session = await get_session(session_id)
    return [
        recording
        async for recording in Recording.objects.filter(session=session)
        .exclude(status=Recording.Status.DELETED)
        .order_by("-created_at")
    ]


async def delete_recording(session_id: str, recording_id: str) -> Recording:
    session = await get_session(session_id)
    recording = await Recording.objects.filter(id=recording_id, session=session).afirst()
    if recording is None:
        raise RecordingNotFound("Recording not found")
    if recording.status in Recording.IN_FLIGHT_STATUSES:
        raise RecordingInFlight(f"Recording is {recording.status} -- stop it before deleting")

    if recording.gcs_object_key:
        try:
            await get_storage_provider().delete_object(recording.gcs_object_key)
        except Exception:
            # The row must still be marked deleted: leaving it pointing at an object we
            # intended to remove is worse than an orphan in the bucket, which retention
            # will sweep.
            logger.warning(
                "Couldn't delete %s from storage", recording.gcs_object_key, exc_info=True
            )

    recording.status = Recording.Status.DELETED
    recording.gcs_object_key = ""
    recording.gcs_bucket = ""
    await recording.asave(update_fields=["status", "gcs_object_key", "gcs_bucket", "updated_at"])
    return recording


async def playback_url(session_id: str, recording_id: str | None) -> dict:
    session = await get_session(session_id)
    query = Recording.objects.filter(session=session)

    if recording_id:
        recording = await query.filter(id=recording_id).afirst()
        if recording is None:
            raise RecordingNotFound("Recording not found")
    else:
        recording = (
            await query.filter(status=Recording.Status.COMPLETE)
            .order_by("-egress_ended_at")
            .afirst()
        )
        if recording is None:
            if await query.filter(status__in=Recording.IN_FLIGHT_STATUSES).aexists():
                raise RecordingNotComplete("Recording is still in progress")
            raise RecordingNotFound("No complete recording for this session")

    if recording.status != Recording.Status.COMPLETE:
        raise RecordingNotComplete(f"Recording is {recording.status}")

    storage = get_storage_provider()
    # Egress reports the job finished before the upload has necessarily landed, so the
    # object's presence is checked rather than assumed.
    if not await storage.object_exists(recording.gcs_object_key):
        raise RecordingNotYetInStorage("Recording is not yet available in storage")

    expiry_seconds = settings.signed_url_expiry_minutes * 60
    url = await storage.signed_url(recording.gcs_object_key, expiry_seconds)
    return {
        "url": url,
        "expires_in": expiry_seconds,
        "recording_id": recording.id,
        "duration_seconds": recording.duration_seconds,
        "file_size_bytes": recording.file_size_bytes,
    }


def mark_complete_sync(recording_id: str, file_info: FileInfo) -> None:
    Recording.objects.filter(id=recording_id).update(
        status=Recording.Status.COMPLETE,
        gcs_object_key=file_info.storage_path,
        duration_seconds=file_info.duration_seconds,
        file_size_bytes=file_info.file_size_bytes,
        content_type=file_info.content_type,
        checksum=file_info.checksum,
        egress_ended_at=timezone.now(),
    )


def mark_failed_sync(recording_id: str, reason: str) -> None:
    Recording.objects.filter(id=recording_id).update(
        status=Recording.Status.FAILED,
        failure_reason=reason,
        egress_ended_at=timezone.now(),
    )


mark_complete = sync_to_async(mark_complete_sync)
mark_failed = sync_to_async(mark_failed_sync)
