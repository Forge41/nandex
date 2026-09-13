"""Interview session lifecycle.

Reaches tps and vas only through apps.core.services.room_service. That boundary is what
keeps this app free of provider knowledge and core free of interview knowledge.
"""

import json
import logging

from asgiref.sync import sync_to_async
from django.db import transaction
from django.utils import timezone

from apps.core.clients.vas_client import VasError, VasUnavailable
from apps.core.services import room_service
from apps.interview import workflow_client
from apps.interview.config import settings
from apps.interview.models import (
    InterviewRound,
    InterviewSession,
    ResumeFacts,
    SessionRecording,
    candidate_identity_for,
    room_name_for,
)
from apps.interview.rounds import DEFAULT_ROUNDS, STAGE_IDS, TOTAL_DURATION_MIN

logger = logging.getLogger(__name__)


class InterviewError(Exception):
    """Carries the status a caller should see, so views stay a dispatch table."""

    status = 400

    def __init__(self, detail: str) -> None:
        super().__init__(detail)
        self.detail = detail


class SessionEnded(InterviewError):
    status = 409


class RoomUnavailable(InterviewError):
    status = 502


def _create_session_sync(project_id: str, user_id: str, role_title: str) -> InterviewSession:
    with transaction.atomic():
        session = InterviewSession(
            project_id=project_id,
            user_id=user_id,
            role_title=role_title,
            total_duration_min=TOTAL_DURATION_MIN,
        )
        # room_name derives from the id, so it has to be set after the default fires.
        session.room_name = room_name_for(session.id)
        session.save()
        InterviewRound.objects.bulk_create(
            InterviewRound(session=session, order=index, **spec)
            for index, spec in enumerate(DEFAULT_ROUNDS)
        )
        return session


create_session = sync_to_async(_create_session_sync, thread_sensitive=True)


def _load_sync(session: InterviewSession) -> tuple[list, ResumeFacts | None, list]:
    rounds = list(session.rounds.all())
    facts = ResumeFacts.objects.filter(session=session).first()
    turns = list(session.transcript.all())
    return rounds, facts, turns


load_for_serialization = sync_to_async(_load_sync, thread_sensitive=True)


async def get_owned_session(session_id: str, user_id: str) -> InterviewSession | None:
    """Scoped by user_id, so one candidate cannot read another's session by guessing an
    id. A session that exists but belongs to someone else is indistinguishable from one
    that does not."""
    return await InterviewSession.objects.filter(id=session_id, user_id=user_id).afirst()


async def update_session(session: InterviewSession, body: dict) -> InterviewSession:
    fields: list[str] = []

    consent = body.get("consent")
    if isinstance(consent, dict):
        for key, field in (
            ("recording", "consent_recording"),
            ("aiInterviewer", "consent_ai_interviewer"),
            ("integrityMonitoring", "consent_integrity_monitoring"),
        ):
            if key in consent:
                setattr(session, field, bool(consent[key]))
                fields.append(field)

    stage = body.get("activeStage")
    advanced_to = None
    if stage is not None:
        if stage not in STAGE_IDS:
            raise InterviewError(f"Unknown stage: {stage}")
        reached = STAGE_IDS.index(stage)
        # An interview runs forwards, and this is where that is true rather than
        # merely observed: a candidate who has seen a later round must not be able to
        # return to an earlier one and keep working on it knowing what comes next.
        # Refused here as well as in the browser, because the browser is theirs.
        if reached < session.progress_index:
            raise InterviewError(f"Round already finished: {stage}")
        if stage != session.active_stage:
            advanced_to = stage
        session.active_stage = stage
        fields.append("active_stage")
        if reached > session.progress_index:
            session.progress_index = reached
            fields.append("progress_index")

    if body.get("start") and session.started_at is None:
        session.started_at = timezone.now()
        session.status = InterviewSession.Status.ACTIVE
        fields += ["started_at", "status"]

    if fields:
        await session.asave(update_fields=[*fields, "updated_at"])
    if advanced_to is not None:
        # The server decides how far ahead to prepare, not the browser: a client that
        # asked for its own rounds could ask for all of them.
        await workflow_client.round_reached(session.id, advanced_to)
    return session


async def mint_join_token(session: InterviewSession) -> dict:
    """The authorization-critical path.

    The identity is derived from the session id and any identity in the request body is
    ignored -- that is the single most important property here. A browser that could
    choose its own identity could join as the interviewer, or as another candidate.
    """
    if session.status == InterviewSession.Status.ENDED:
        raise SessionEnded("This interview has ended")

    agent_metadata = json.dumps({"session_id": session.id, "stage": session.active_stage})
    try:
        minted = await room_service.mint_join_token(
            session.project_id,
            session.room_name,
            candidate_identity_for(session.id),
            ttl_seconds=settings.join_token_ttl_seconds,
            agents=((settings.agent_name, agent_metadata),),
        )
    except room_service.RoomUnavailable as e:
        raise RoomUnavailable("Video service unavailable") from e

    await _arm_recording(session)

    return {
        "token": minted["token"],
        "ws_url": minted["ws_url"],
        "room_name": session.room_name,
        "expires_in": minted["expires_in"],
        "identity": candidate_identity_for(session.id),
        "recording_state": session.recording_state,
    }


async def _arm_recording(session: InterviewSession) -> None:
    """Recording starts automatically on first join, gated on consent.

    The design has no record button and its consent text promises integrity monitoring
    during timed tasks, so a click-driven trigger would let a candidate silently decline.

    "On first join" is not "when a token is minted": a provider room does not exist until
    its first participant joins, and asking to record one that does not exist fails. So
    this arms the recording -- registers the room and asks the video service to start the
    moment the room appears -- rather than starting it here.

    Nothing here may raise: a candidate locked out of their interview is worse than an
    unrecorded one. A failure is logged and parked in recording_state, which is why that
    field exists on the session rather than being inferred.
    """
    if not session.consent_recording:
        return
    if session.recording_state != InterviewSession.RecordingState.OFF:
        return

    try:
        session.vas_session_id = await room_service.ensure_artifact_session(
            session.id,
            session.room_name,
            {"role_title": session.role_title},
            auto_record=True,
        )
    except (room_service.RoomUnavailable, VasError, VasUnavailable):
        logger.warning("Couldn't arm recording for session %s", session.id, exc_info=True)
        session.recording_state = InterviewSession.RecordingState.FAILED
        await session.asave(update_fields=["recording_state", "updated_at"])
        return

    session.recording_state = InterviewSession.RecordingState.ARMED
    await session.asave(update_fields=["vas_session_id", "recording_state", "updated_at"])


async def control_recording(session: InterviewSession, action: str) -> dict:
    """Operator- or UI-driven control. An interview does not start recording this way --
    see _ensure_recording -- but other features and an operator need the handle."""
    if action not in ("start", "stop"):
        raise InterviewError("action must be 'start' or 'stop'")

    if action == "start":
        if not session.consent_recording:
            raise InterviewError("The candidate has not consented to recording")
        if not session.vas_session_id:
            try:
                session.vas_session_id = await room_service.ensure_artifact_session(
                    session.id, session.room_name, {"role_title": session.role_title}
                )
            except room_service.RoomUnavailable as e:
                raise RoomUnavailable("Video service unavailable") from e
            await session.asave(update_fields=["vas_session_id", "updated_at"])

    if not session.vas_session_id:
        raise InterviewError("Nothing has been recorded for this session")

    try:
        if action == "start":
            recording = await room_service.start_recording(session.vas_session_id)
            session.recording_state = InterviewSession.RecordingState.RECORDING
        else:
            recording = await room_service.stop_recording(session.vas_session_id)
            session.recording_state = InterviewSession.RecordingState.STOPPED
    except VasError as e:
        # vas's status is meaningful here: a 409 really does mean one is already running,
        # which is a different thing for a caller than a fault, so it is passed through
        # rather than flattened into a 502.
        failure = InterviewError(e.detail)
        failure.status = e.status
        raise failure from e
    except (VasUnavailable, room_service.RoomUnavailable) as e:
        raise RoomUnavailable("Video service unavailable") from e

    await session.asave(update_fields=["recording_state", "updated_at"])
    return {"recordingState": session.recording_state, "recording": recording}


async def end_session(session: InterviewSession) -> InterviewSession:
    """Idempotent: a candidate whose tab closed and who then hits End should not see an
    error, and the pagehide beacon and an explicit click can both arrive."""
    if session.status == InterviewSession.Status.ENDED:
        return session

    if session.vas_session_id and session.recording_state in (
        InterviewSession.RecordingState.ARMED,
        InterviewSession.RecordingState.RECORDING,
    ):
        try:
            await room_service.stop_recording(session.vas_session_id)
            session.recording_state = InterviewSession.RecordingState.STOPPED
        except (VasError, VasUnavailable, room_service.RoomUnavailable):
            # Egress finalizes on its own when the last participant leaves, so failing
            # to stop it explicitly is a nuisance, not data loss.
            logger.warning("Couldn't stop recording for session %s", session.id, exc_info=True)

    session.status = InterviewSession.Status.ENDED
    session.ended_at = timezone.now()
    await session.asave(update_fields=["status", "ended_at", "recording_state", "updated_at"])
    await trigger_post_session_processing(session.id)
    return session


async def trigger_post_session_processing(session_id: str) -> None:
    """Tells the session's workflow to stop preparing rounds and wind up.

    A signal rather than a start: the workflow exists only where a resume was uploaded,
    and a session that never had one has nothing generating to stop. /end and the
    recording callback can both send it -- the workflow ignores the second.
    """
    await workflow_client.session_ended(session_id)


def record_recording_sync(session: InterviewSession, payload: dict) -> SessionRecording:
    """Upserts on (session, vas_recording_id) -- that constraint is the callback's
    idempotency mechanism, so a retried delivery updates one row instead of adding one."""
    recording, _ = SessionRecording.objects.update_or_create(
        session=session,
        vas_recording_id=payload.get("id") or "",
        defaults={
            "egress_id": payload.get("egress_id") or "",
            "status": payload.get("status") or "",
            "gcs_bucket": payload.get("gcs_bucket") or "",
            "gcs_object_key": payload.get("gcs_object_key") or "",
            "duration_seconds": payload.get("duration_seconds"),
            "file_size_bytes": payload.get("file_size_bytes"),
            "checksum": payload.get("checksum") or "",
            "failure_reason": payload.get("failure_reason") or "",
        },
    )
    return recording
