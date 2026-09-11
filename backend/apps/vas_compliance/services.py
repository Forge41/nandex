"""Deletion requests. The work itself is a Temporal workflow -- deleting every object for
a session re-hits a rate-limited storage API and must survive a restart mid-way."""

import logging

from apps.vas_compliance.models import ArtifactDeletion
from apps.vas_recordings import services as recording_services
from apps.vas_recordings.models import Recording

logger = logging.getLogger(__name__)


class ActiveRecordingExists(recording_services.VasError):
    status = 409


class DeletionNotFound(recording_services.VasError):
    status = 404


async def request_deletion(session_id: str, requested_by: str, reason: str) -> ArtifactDeletion:
    session = await recording_services.get_session(session_id)

    # Deleting under a running Egress would race the upload: the job would recreate the
    # object we just removed.
    active = await Recording.objects.filter(
        session=session, status__in=Recording.IN_FLIGHT_STATUSES
    ).afirst()
    if active is not None:
        raise ActiveRecordingExists(f"Stop recording {active.egress_id} before deleting")

    deletion = await ArtifactDeletion.objects.acreate(
        session_id=session.id, requested_by=requested_by, reason=reason
    )

    from apps.vas_recordings.workflows import trigger_artifact_deletion

    await trigger_artifact_deletion(session.id, deletion.id)
    return deletion


async def get_deletion(deletion_id: str) -> ArtifactDeletion:
    deletion = await ArtifactDeletion.objects.filter(id=deletion_id).afirst()
    if deletion is None:
        raise DeletionNotFound("Deletion not found")
    return deletion
