"""Fake providers, so the recording tests touch neither LiveKit nor GCS.

The registries are module-level caches, so each fixture swaps them and restores them --
a leaked fake would make a later test pass against nothing.
"""

import pytest

from apps.vas_recordings import providers
from apps.vas_recordings.models import VideoSession
from apps.vas_recordings.providers.base import (
    EgressResult,
    EgressStatus,
    RecordingOptions,
    StorageUploadConfig,
)


class FakeEgressProvider:
    def __init__(self) -> None:
        self.started: list[tuple[str, RecordingOptions]] = []
        self.stopped: list[str] = []
        self.counter = 0

    async def start_recording(self, room_name: str, options: RecordingOptions) -> EgressResult:
        self.counter += 1
        egress_id = f"eg-{self.counter}"
        self.started.append((room_name, options))
        return EgressResult(egress_id=egress_id, status=EgressStatus.STARTING)

    async def stop_recording(self, egress_id: str) -> None:
        self.stopped.append(egress_id)


class FakeStorageProvider:
    def __init__(self) -> None:
        # Flipped by tests that need to simulate the upload lagging behind egress_ended.
        self.object_present = True
        self.deleted: list[str] = []

    def upload_config(self, path: str) -> StorageUploadConfig:
        return StorageUploadConfig(backend="gcs", bucket="test-bucket", path=path)

    async def signed_url(self, path: str, expiry_seconds: int) -> str:
        return f"https://storage.test/{path}?expires={expiry_seconds}"

    async def object_exists(self, path: str) -> bool:
        return self.object_present

    async def delete_object(self, path: str) -> None:
        self.deleted.append(path)


@pytest.fixture
def fake_egress(monkeypatch):
    provider = FakeEgressProvider()
    monkeypatch.setattr(providers, "get_egress_provider", lambda: provider)
    monkeypatch.setattr("apps.vas_recordings.services.get_egress_provider", lambda: provider)
    return provider


@pytest.fixture
def fake_storage(monkeypatch):
    provider = FakeStorageProvider()
    monkeypatch.setattr(providers, "get_storage_provider", lambda: provider)
    monkeypatch.setattr("apps.vas_recordings.services.get_storage_provider", lambda: provider)
    return provider


@pytest.fixture
async def video_session(db):
    return await VideoSession.objects.acreate(
        external_session_id="iv-1", room_name="interview-iv-1"
    )
