"""Provider-neutral value types and protocols for recording and storage.

This is the seam a second recorder or a second bucket plugs into. It says nothing about
LiveKit or GCS -- the concrete providers live beside this file and are selected by
settings, the same shape as apps.tps's handler registry.
"""

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Protocol, runtime_checkable


class EgressStatus(StrEnum):
    STARTING = "starting"
    ACTIVE = "active"
    ENDING = "ending"
    COMPLETE = "complete"
    FAILED = "failed"
    ABORTED = "aborted"
    LIMIT_REACHED = "limit_reached"


@dataclass(frozen=True)
class StorageUploadConfig:
    backend: str
    bucket: str
    path: str


@dataclass(frozen=True)
class RecordingOptions:
    storage_path: str
    storage_config: StorageUploadConfig
    layout: str = "speaker"
    audio_only: bool = False


@dataclass(frozen=True)
class FileInfo:
    """duration_seconds is seconds, not the provider's native unit -- LiveKit reports
    nanoseconds, and a recording whose duration is off by 1e9 reads as plausible."""

    storage_path: str
    duration_seconds: float
    file_size_bytes: int
    content_type: str = "video/mp4"
    checksum: str = ""


@dataclass(frozen=True)
class EgressResult:
    egress_id: str
    status: EgressStatus
    file_info: FileInfo | None = None
    error: str = ""


@dataclass(frozen=True)
class ProviderEvent:
    """One normalized provider lifecycle event. room_name is how we find our own session
    row, so the provider must be asked to echo the name we gave it."""

    event_id: str
    event_type: str
    room_name: str = ""
    egress_id: str = ""
    egress_result: EgressResult | None = None
    raw_payload: dict = field(default_factory=dict)


@runtime_checkable
class EgressProvider(Protocol):
    async def start_recording(self, room_name: str, options: RecordingOptions) -> EgressResult: ...

    async def stop_recording(self, egress_id: str) -> None: ...


@runtime_checkable
class WebhookValidator(Protocol):
    def validate_and_parse(self, raw_body: bytes, auth_header: str) -> ProviderEvent:
        """raw_body must be the exact bytes received. Raises ValueError on a bad
        signature, an unparseable body, or an event older than the replay window."""
        ...


@runtime_checkable
class StorageProvider(Protocol):
    def upload_config(self, path: str) -> StorageUploadConfig: ...

    async def signed_url(self, path: str, expiry_seconds: int) -> str: ...

    async def object_exists(self, path: str) -> bool: ...

    async def delete_object(self, path: str) -> None:
        """Idempotent: a missing object is success, not an error."""
        ...
