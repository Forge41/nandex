"""LiveKit egress and webhook validation.

Every call is natively async. The upstream service wrapped these in asyncio.run(), which
works under WSGI but raises inside a running event loop -- this project serves ASGI.
"""

import logging
import time

from livekit import api
from livekit.protocol import egress as egress_proto

from apps.vas_recordings.providers.base import (
    EgressResult,
    EgressStatus,
    FileInfo,
    ProviderEvent,
    RecordingOptions,
)

logger = logging.getLogger(__name__)

NANOSECONDS_PER_SECOND = 1_000_000_000

_STATUS_BY_PROTO_VALUE = {
    egress_proto.EgressStatus.EGRESS_STARTING: EgressStatus.STARTING,
    egress_proto.EgressStatus.EGRESS_ACTIVE: EgressStatus.ACTIVE,
    egress_proto.EgressStatus.EGRESS_ENDING: EgressStatus.ENDING,
    egress_proto.EgressStatus.EGRESS_COMPLETE: EgressStatus.COMPLETE,
    egress_proto.EgressStatus.EGRESS_FAILED: EgressStatus.FAILED,
    egress_proto.EgressStatus.EGRESS_ABORTED: EgressStatus.ABORTED,
    egress_proto.EgressStatus.EGRESS_LIMIT_REACHED: EgressStatus.LIMIT_REACHED,
}


def _file_info(proto_file) -> FileInfo:
    return FileInfo(
        storage_path=proto_file.filename,
        duration_seconds=proto_file.duration / NANOSECONDS_PER_SECOND,
        file_size_bytes=proto_file.size,
    )


class LiveKitEgressProvider:
    def __init__(self, host: str, api_key: str, api_secret: str) -> None:
        self._host = host
        self._api_key = api_key
        self._api_secret = api_secret

    def _client(self) -> api.LiveKitAPI:
        return api.LiveKitAPI(self._host, self._api_key, self._api_secret)

    async def start_recording(self, room_name: str, options: RecordingOptions) -> EgressResult:
        config = options.storage_config
        if config.backend != "gcs":
            raise ValueError(f"Unsupported storage backend for egress: {config.backend!r}")

        request = api.RoomCompositeEgressRequest(
            room_name=room_name,
            layout=options.layout,
            audio_only=options.audio_only,
            file=egress_proto.EncodedFileOutput(
                filepath=options.storage_path,
                gcp=egress_proto.GCPUpload(bucket=config.bucket),
            ),
        )

        client = self._client()
        try:
            info = await client.egress.start_room_composite_egress(request)
        finally:
            await client.aclose()
        return EgressResult(egress_id=info.egress_id, status=EgressStatus.STARTING)

    async def stop_recording(self, egress_id: str) -> None:
        client = self._client()
        try:
            await client.egress.stop_egress(egress_proto.StopEgressRequest(egress_id=egress_id))
        finally:
            await client.aclose()


class LiveKitWebhookValidator:
    def __init__(self, api_key: str, api_secret: str, max_age_seconds: int) -> None:
        self._receiver = api.WebhookReceiver(
            api.TokenVerifier(api_key=api_key, api_secret=api_secret)
        )
        self._max_age_seconds = max_age_seconds

    def validate_and_parse(self, raw_body: bytes, auth_header: str) -> ProviderEvent:
        try:
            body = raw_body.decode("utf-8")
        except UnicodeDecodeError as e:
            raise ValueError("Webhook body is not valid UTF-8") from e

        event = self._receiver.receive(body, auth_header)

        # The signature alone doesn't stop a captured request being sent again later.
        if event.created_at and time.time() - event.created_at > self._max_age_seconds:
            raise ValueError("Webhook event is older than the replay window")

        return self._normalize(event)

    def _normalize(self, event) -> ProviderEvent:
        egress_id = ""
        egress_result = None

        info = event.egress_info
        if info and info.egress_id:
            egress_id = info.egress_id
            file_info = _file_info(info.file_results[0]) if info.file_results else None
            egress_result = EgressResult(
                egress_id=egress_id,
                status=_STATUS_BY_PROTO_VALUE.get(info.status, EgressStatus.FAILED),
                file_info=file_info,
                error=info.error or "",
            )

        return ProviderEvent(
            event_id=event.id,
            event_type=event.event,
            room_name=event.room.name if event.room else "",
            egress_id=egress_id,
            egress_result=egress_result,
        )
