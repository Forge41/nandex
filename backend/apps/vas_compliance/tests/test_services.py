"""Ported from the upstream service's artifact suite."""

import pytest

from apps.vas_compliance import services
from apps.vas_compliance.models import ArtifactDeletion
from apps.vas_recordings.models import Recording, VideoSession
from apps.vas_recordings.services import SessionNotFound

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def capture_deletions(monkeypatch):
    started: list[tuple[str, str]] = []

    async def fake_trigger(session_id: str, deletion_id: str) -> None:
        started.append((session_id, deletion_id))

    monkeypatch.setattr("apps.vas_recordings.workflows.trigger_artifact_deletion", fake_trigger)
    return started


async def _session():
    return await VideoSession.objects.acreate(
        external_session_id="iv-1", room_name="interview-iv-1"
    )


async def test_request_deletion_creates_a_pending_row_and_starts_the_workflow(
    capture_deletions,
):
    session = await _session()
    deletion = await services.request_deletion(session.id, "admin", "gdpr request")

    assert deletion.status == ArtifactDeletion.Status.PENDING
    assert deletion.session_id == session.id
    assert capture_deletions == [(session.id, deletion.id)]


async def test_request_deletion_on_an_unknown_session_is_a_404(capture_deletions, db):
    with pytest.raises(SessionNotFound):
        await services.request_deletion("no-such-session", "admin", "reason")


async def test_deletion_is_refused_while_a_recording_is_in_flight(capture_deletions):
    """Deleting under a running Egress would race the upload: the job would recreate the
    object we just removed."""
    session = await _session()
    await Recording.objects.acreate(
        session=session, egress_id="eg-1", status=Recording.Status.ACTIVE
    )

    with pytest.raises(services.ActiveRecordingExists):
        await services.request_deletion(session.id, "admin", "reason")
    assert capture_deletions == []


async def test_get_deletion_round_trips_by_id(capture_deletions):
    session = await _session()
    created = await services.request_deletion(session.id, "admin", "reason")

    found = await services.get_deletion(created.id)
    assert found.id == created.id
    assert found.status == ArtifactDeletion.Status.PENDING


async def test_get_deletion_on_an_unknown_id_is_a_404(db):
    with pytest.raises(services.DeletionNotFound):
        await services.get_deletion("no-such-deletion")
