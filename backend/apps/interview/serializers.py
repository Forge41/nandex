"""Hand-written dict builders. The keys are camelCase because they are consumed directly
by frontend/lib/interview/types.ts -- this is the contract with the UI, so the shape
lives in one readable place rather than being derived.
"""

from apps.interview.models import (
    InterviewRound,
    InterviewSession,
    ResumeFacts,
    SessionRecording,
    TranscriptTurn,
)


def serialize_round(round_: InterviewRound) -> dict:
    payload = {
        "id": round_.stage_id,
        "label": round_.label,
        "kind": round_.kind,
        "durationMin": round_.duration_min,
        # Whether this round's task has been generated. Distinct from where the round
        # sits in the interview, which the client derives from progressIndex.
        "contentState": round_.content_state,
    }
    # Omitted rather than null when absent: the frontend's Round type marks both
    # optional, and a null citation would render an empty chip.
    if round_.citation is not None:
        payload["citation"] = round_.citation
    if round_.summary:
        payload["summary"] = round_.summary
    return payload


def serialize_resume(facts: ResumeFacts) -> dict:
    payload = {
        "fileName": facts.file_name,
        "sizeBytes": facts.size_bytes,
        "entityCount": facts.entity_count,
        "candidate": {
            "name": facts.candidate_name,
            "title": facts.candidate_title,
            "location": facts.candidate_location,
            "email": facts.candidate_email,
            "yearsExperience": facts.candidate_years_experience or 0,
        },
        "sections": facts.sections,
        "probes": facts.probes,
        "citations": facts.citations,
    }
    # Only present once the document was actually parsed. Asserting "2 pages" beside a
    # visibly one-page document is the fabrication this field's optionality exists for.
    if facts.page_count is not None:
        payload["pageCount"] = facts.page_count
    return payload


def serialize_turn(turn: TranscriptTurn) -> dict:
    payload = {
        "id": turn.id,
        "speaker": turn.speaker,
        "text": turn.text,
        "atSeconds": turn.at_seconds,
    }
    if turn.assessments:
        payload["assessments"] = turn.assessments
    return payload


def serialize_recording(recording: SessionRecording) -> dict:
    return {
        "id": recording.id,
        "status": recording.status,
        "durationSeconds": recording.duration_seconds,
        "fileSizeBytes": recording.file_size_bytes,
    }


def serialize_session(
    session: InterviewSession,
    rounds: list[InterviewRound],
    facts: ResumeFacts | None,
    turns: list[TranscriptTurn],
) -> dict:
    return {
        "id": session.id,
        "candidateName": session.candidate_name,
        "roleTitle": session.role_title,
        "totalDurationMin": session.total_duration_min,
        "rounds": [serialize_round(r) for r in rounds],
        "resume": serialize_resume(facts) if facts else None,
        "activeStage": session.active_stage,
        "progressIndex": session.progress_index,
        "consent": {
            "recording": session.consent_recording,
            "aiInterviewer": session.consent_ai_interviewer,
            "integrityMonitoring": session.consent_integrity_monitoring,
        },
        "startedAt": session.started_at.isoformat() if session.started_at else None,
        "status": session.status,
        "recordingState": session.recording_state,
        "planState": session.plan_state,
        "planError": session.plan_error,
        # Keyed by stage id, matching RoundContent. Rounds with nothing generated are
        # absent, which is what the UI's missing-content state reads.
        "content": {r.stage_id: r.content for r in rounds if r.content},
        "transcript": [serialize_turn(t) for t in turns],
    }
