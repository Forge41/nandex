"""Ported from the upstream service's own unit suite, which is the behavioural spec for
this reformat -- the rewrite is only worth anything if it preserves these answers.
"""

import pytest

from apps.vas_recordings import services
from apps.vas_recordings.models import Recording, VideoSession
from apps.vas_recordings.providers.base import FileInfo

pytestmark = pytest.mark.django_db(transaction=True)


async def test_registering_a_session_twice_returns_the_same_row():
    first = await services.register_session("iv-9", "interview-iv-9", {})
    second = await services.register_session("iv-9", "interview-iv-9", {"ignored": True})

    assert first.id == second.id
    assert await VideoSession.objects.acount() == 1


async def test_registration_stores_the_callers_room_name_verbatim():
    """tps signs join tokens against this exact string, so deriving one here would put
    two authorities on the same name."""
    session = await services.register_session("iv-9", "a-name-we-did-not-choose", {})
    assert session.room_name == "a-name-we-did-not-choose"


async def test_start_recording_creates_a_row_pointing_at_the_upload_path(
    video_session, fake_egress, fake_storage
):
    recording = await services.start_recording(video_session.id, "speaker", False)

    assert recording.status == Recording.Status.STARTING
    assert recording.egress_id == "eg-1"
    assert recording.gcs_bucket == "test-bucket"
    assert recording.gcs_object_key.startswith(f"recordings/{video_session.id}/")

    room_name, options = fake_egress.started[0]
    assert room_name == "interview-iv-1"
    assert options.storage_path == recording.gcs_object_key


async def test_start_recording_on_an_unknown_session_is_a_404(fake_egress, fake_storage, db):
    with pytest.raises(services.SessionNotFound):
        await services.start_recording("no-such-session", "speaker", False)


async def test_a_second_concurrent_recording_is_refused(video_session, fake_egress, fake_storage):
    await services.start_recording(video_session.id, "speaker", False)
    with pytest.raises(services.RecordingAlreadyActive):
        await services.start_recording(video_session.id, "speaker", False)


async def test_stop_recording_moves_it_to_ending_and_calls_the_provider(
    video_session, fake_egress, fake_storage
):
    started = await services.start_recording(video_session.id, "speaker", False)
    stopped = await services.stop_recording(video_session.id, None)

    assert stopped.id == started.id
    assert stopped.status == Recording.Status.ENDING
    assert fake_egress.stopped == [started.egress_id]


async def test_stopping_twice_is_idempotent(video_session, fake_egress, fake_storage):
    """Egress finalizes on its own when the last participant leaves, so a caller can
    legitimately stop a recording that is already finished. That must not be an error
    the caller has no way to act on."""
    started = await services.start_recording(video_session.id, "speaker", False)
    await Recording.objects.filter(id=started.id).aupdate(status=Recording.Status.COMPLETE)

    stopped = await services.stop_recording(video_session.id, None)
    assert stopped.id == started.id
    assert stopped.status == Recording.Status.COMPLETE
    assert fake_egress.stopped == []


async def test_stop_recording_with_no_recording_at_all_is_a_404(
    video_session, fake_egress, fake_storage
):
    with pytest.raises(services.RecordingNotFound):
        await services.stop_recording(video_session.id, None)


async def test_list_recordings_starts_empty_and_hides_deleted_rows(
    video_session, fake_egress, fake_storage
):
    assert await services.list_recordings(video_session.id) == []

    first = await services.start_recording(video_session.id, "speaker", False)
    assert len(await services.list_recordings(video_session.id)) == 1

    await Recording.objects.filter(id=first.id).aupdate(status=Recording.Status.DELETED)
    assert await services.list_recordings(video_session.id) == []


async def test_playback_url_is_signed_for_a_complete_recording(
    video_session, fake_egress, fake_storage
):
    recording = await services.start_recording(video_session.id, "speaker", False)
    await services.mark_complete(
        recording.id,
        FileInfo(
            storage_path=recording.gcs_object_key, duration_seconds=100.0, file_size_bytes=1024
        ),
    )

    result = await services.playback_url(video_session.id, None)
    assert result["url"].startswith("https://storage.test/")
    assert result["duration_seconds"] == 100.0
    assert result["file_size_bytes"] == 1024


async def test_playback_url_refuses_while_the_object_is_still_uploading(
    video_session, fake_egress, fake_storage
):
    """Egress reports the job ended before the upload has necessarily landed, so a
    signed URL handed out here would 404 in the player."""
    recording = await services.start_recording(video_session.id, "speaker", False)
    await services.mark_complete(
        recording.id,
        FileInfo(storage_path=recording.gcs_object_key, duration_seconds=1.0, file_size_bytes=1),
    )
    fake_storage.object_present = False

    with pytest.raises(services.RecordingNotYetInStorage):
        await services.playback_url(video_session.id, None)


async def test_playback_url_distinguishes_in_progress_from_absent(
    video_session, fake_egress, fake_storage
):
    with pytest.raises(services.RecordingNotFound):
        await services.playback_url(video_session.id, None)

    await services.start_recording(video_session.id, "speaker", False)
    with pytest.raises(services.RecordingNotComplete):
        await services.playback_url(video_session.id, None)


async def test_deleting_a_recording_removes_the_object_and_clears_the_reference(
    video_session, fake_egress, fake_storage
):
    recording = await services.start_recording(video_session.id, "speaker", False)
    object_key = recording.gcs_object_key
    await Recording.objects.filter(id=recording.id).aupdate(status=Recording.Status.COMPLETE)

    deleted = await services.delete_recording(video_session.id, recording.id)

    assert deleted.status == Recording.Status.DELETED
    assert deleted.gcs_object_key == ""
    assert fake_storage.deleted == [object_key]


async def test_an_in_flight_recording_cannot_be_deleted(video_session, fake_egress, fake_storage):
    recording = await services.start_recording(video_session.id, "speaker", False)
    with pytest.raises(services.RecordingInFlight):
        await services.delete_recording(video_session.id, recording.id)
    assert fake_storage.deleted == []


async def test_recording_a_room_the_provider_does_not_have_yet_is_a_409(
    video_session, fake_storage, monkeypatch
):
    """Egress answers not_found until the room's first participant joins. A 5xx here
    would burn core's retry budget on something no retry can fix, so it is a 409.
    """
    from apps.vas_recordings.providers.base import RoomNotReady

    class NotReadyEgress:
        async def start_recording(self, room_name, options):
            raise RoomNotReady(room_name)

        async def stop_recording(self, egress_id):
            return None

    monkeypatch.setattr(
        "apps.vas_recordings.services.get_egress_provider", lambda: NotReadyEgress()
    )

    with pytest.raises(services.RoomNotStarted) as exc_info:
        await services.start_recording(video_session.id, "speaker", False)

    assert exc_info.value.status == 409
    assert await Recording.objects.acount() == 0


async def test_auto_record_can_be_turned_on_by_a_later_registration():
    """A candidate may consent after the session was first registered, so the idempotent
    path has to let the flag rise."""
    first = await services.register_session("iv-late", "interview-iv-late", {})
    assert first.auto_record is False

    second = await services.register_session("iv-late", "interview-iv-late", {}, auto_record=True)

    assert second.id == first.id
    assert second.auto_record is True
