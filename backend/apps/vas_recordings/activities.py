"""Temporal activities for vas. Activities touch the ORM and storage; workflows above
stay deterministic and reference them only by import inside the run method.
"""

import hashlib
import hmac
import json
import logging
import time

import httpx
from asgiref.sync import sync_to_async
from django.utils import timezone
from temporalio import activity

from apps.vas_compliance.models import ArtifactDeletion
from apps.vas_recordings.config import settings
from apps.vas_recordings.models import Recording
from apps.vas_recordings.providers import get_storage_provider

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = (
    Recording.Status.COMPLETE,
    Recording.Status.FAILED,
    Recording.Status.ABORTED,
    Recording.Status.LIMIT_REACHED,
)


def sign_callback(raw_body: bytes, timestamp: str, secret: str) -> str:
    """Signs the exact bytes that will be sent. The receiver must verify against
    request.body for the same reason: re-serializing the parsed dict changes key order
    and separator whitespace, and the signature with it."""
    message = b"callback:" + raw_body + b":" + timestamp.encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


@activity.defn
async def verify_recording_object_exists(recording_id: str) -> None:
    recording = await Recording.objects.filter(id=recording_id).afirst()
    if recording is None:
        # Nothing to wait for; failing here would retry twelve times over a row that
        # will never appear.
        return
    if not await get_storage_provider().object_exists(recording.gcs_object_key):
        raise RuntimeError(f"{recording.gcs_object_key} is not in storage yet")


def _callback_payload_sync(recording_id: str) -> dict | None:
    recording = Recording.objects.select_related("session").filter(id=recording_id).first()
    if recording is None:
        return None
    return {
        "event": "recording.complete",
        "external_session_id": recording.session.external_session_id,
        "vas_session_id": recording.session.id,
        "recording": {
            "id": recording.id,
            "egress_id": recording.egress_id,
            "status": recording.status,
            "gcs_bucket": recording.gcs_bucket,
            # The object key, never a signed URL: those expire in hours and are fetched
            # on demand.
            "gcs_object_key": recording.gcs_object_key,
            "duration_seconds": recording.duration_seconds,
            "file_size_bytes": recording.file_size_bytes,
            "content_type": recording.content_type,
            "checksum": recording.checksum,
            "failure_reason": recording.failure_reason,
        },
    }


async def _post_callback(payload: dict) -> None:
    if not settings.main_backend_callback_url:
        logger.warning("VAS_MAIN_BACKEND_CALLBACK_URL is unset -- not notifying")
        return

    raw_body = json.dumps(payload).encode()
    timestamp = str(int(time.time()))
    signature = sign_callback(raw_body, timestamp, settings.callback_signing_secret)

    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.post(
            settings.main_backend_callback_url,
            content=raw_body,
            headers={
                "Content-Type": "application/json",
                "X-VAS-Signature": f"sha256={signature}",
                "X-VAS-Timestamp": timestamp,
            },
        )
        response.raise_for_status()


@activity.defn
async def post_recording_to_main_backend(recording_id: str) -> None:
    payload = await sync_to_async(_callback_payload_sync)(recording_id)
    if payload is None:
        return
    await _post_callback(payload)


@activity.defn
async def list_deletable_recordings(session_id: str) -> list[str]:
    return [
        recording_id
        async for recording_id in Recording.objects.filter(
            session_id=session_id, status__in=TERMINAL_STATUSES
        ).values_list("id", flat=True)
    ]


@activity.defn
async def delete_recording_object(recording_id: str) -> None:
    recording = await Recording.objects.filter(id=recording_id).afirst()
    if recording is None:
        return
    if recording.gcs_object_key:
        await get_storage_provider().delete_object(recording.gcs_object_key)
    await Recording.objects.filter(id=recording_id).aupdate(
        status=Recording.Status.DELETED, gcs_object_key="", gcs_bucket=""
    )


@activity.defn
async def finish_artifact_deletion(deletion_id: str) -> None:
    await ArtifactDeletion.objects.filter(id=deletion_id).aupdate(
        status=ArtifactDeletion.Status.COMPLETE,
        gcs_deleted=True,
        completed_at=timezone.now(),
    )
    deletion = await ArtifactDeletion.objects.filter(id=deletion_id).afirst()
    if deletion is None:
        return
    await _post_callback({"event": "artifacts.deleted", "vas_session_id": deletion.session_id})
