"""What the interviewer agent is allowed to ask core for, and to tell it.

Two endpoints, both behind a shared bearer token: read one session's brief, and append
turns to its transcript. The agent never reaches the database and never reaches tps or
vas -- core stays the orchestrator, and the agent is just another caller of it.

Deliberately not the session serializer: the agent has no business with consent flags,
recording state or room names, and a brief that grows every time the session payload
does is a brief nobody has read.
"""

import json
import logging

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt

from apps.interview import coding
from apps.interview.deps import has_agent_token
from apps.interview.models import (
    CodeRun,
    InterviewRound,
    InterviewSession,
    ResumeFacts,
    TranscriptTurn,
)

logger = logging.getLogger(__name__)


def _forbidden() -> JsonResponse:
    return JsonResponse({"detail": "Not authorised"}, status=401)


async def _session(session_id: str) -> InterviewSession | None:
    return await InterviewSession.objects.filter(id=session_id).afirst()


@csrf_exempt
async def session_brief(request: HttpRequest, session_id: str) -> JsonResponse:
    """Everything the interviewer needs to speak about this candidate, and nothing else."""
    if request.method != "GET":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    if not has_agent_token(request):
        return _forbidden()

    session = await _session(session_id)
    if session is None:
        return JsonResponse({"detail": "Session not found"}, status=404)

    return JsonResponse(await sync_to_async(_brief_sync, thread_sensitive=True)(session))


def _brief_sync(session: InterviewSession) -> dict:
    facts = ResumeFacts.objects.filter(session=session).first()
    rounds = list(InterviewRound.objects.filter(session=session))

    return {
        "sessionId": session.id,
        # The session's copy is written from the resume when the plan lands, so these
        # normally agree -- the fallback is for a session whose plan named them and whose
        # own row has not been written yet. The interviewer greets by name, and greeting
        # nobody is worse than either.
        "candidateName": session.candidate_name or (facts.candidate_name if facts else ""),
        "roleTitle": session.role_title,
        "activeStage": session.active_stage,
        "planReady": session.plan_state == InterviewSession.PlanState.READY,
        "totalDurationMin": session.total_duration_min,
        # Only the rounds a candidate is told about. preflight and resume are scaffolding
        # the interviewer would be describing back to someone already looking at it.
        "rounds": [
            {
                "id": r.stage_id,
                "label": r.label,
                "durationMin": r.duration_min,
                "summary": r.summary,
                "citation": r.citation,
            }
            for r in rounds
            if r.stage_id not in ("preflight", "resume")
        ],
        "resume": None
        if facts is None
        else {
            "candidate": {
                "name": facts.candidate_name,
                "title": facts.candidate_title,
                "location": facts.candidate_location,
                "yearsExperience": facts.candidate_years_experience,
            },
            "probes": facts.probes,
            "citations": facts.citations,
        },
        "coding": _coding_sync(session),
    }


def _coding_sync(session: InterviewSession) -> dict | None:
    """What the interviewer may know about the coding round in progress.

    The task, and the counts from the candidate's last run. **Never their source**: an
    interviewer that can quote the code back is reading over a shoulder, and nothing it
    needs to ask requires it. Failing case names are here because "your out-of-order
    replay case is failing -- what do you think is happening there?" is the whole reason
    this round has an interviewer in the room, and "it looks like something is failing"
    is not a question.
    """
    if session.active_stage != "coding":
        return None
    round_ = InterviewRound.objects.filter(session=session, stage_id="coding").first()
    tasks = ((round_.content if round_ else None) or {}).get("tasks") or []
    if not tasks:
        return None

    runs = list(CodeRun.objects.filter(session=session, stage_id="coding").order_by("created_at"))
    last = runs[-1] if runs else None
    task_index = last.task_index if last else 0
    task = tasks[min(task_index, len(tasks) - 1)]
    hidden = coding.hidden_names(task)

    brief = {
        "taskNumber": task_index + 1,
        "taskTotal": len(tasks),
        "title": task.get("title", ""),
        "brief": task.get("brief", []),
        "constraints": task.get("constraints", []),
        "citation": task.get("citation"),
        "language": last.language if last else task.get("defaultLanguage"),
        "hasRun": last is not None,
    }
    if last is None:
        return brief

    visible = [t for t in last.visible_tests(hidden) if t.get("outcome")]
    brief |= {
        "phase": last.phase,
        "passed": sum(1 for t in visible if t["outcome"] == "pass"),
        "total": len(visible),
        "failing": [t["name"] for t in visible if t["outcome"] == "fail"],
        "attemptsUsed": coding.attempts_used(session.id, "coding", task_index),
        "attemptsAllowed": coding.attempts_allowed(task),
    }
    return brief


@csrf_exempt
async def session_transcript(request: HttpRequest, session_id: str) -> JsonResponse:
    """Appends what was said. The agent is the only party that sees final speech-to-text
    with timings, which is why the browser has no path to this."""
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)
    if not has_agent_token(request):
        return _forbidden()

    session = await _session(session_id)
    if session is None:
        return JsonResponse({"detail": "Session not found"}, status=404)

    try:
        turns = json.loads(request.body or b"{}").get("turns")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Body was not valid JSON"}, status=400)
    if not isinstance(turns, list):
        return JsonResponse({"detail": "turns must be a list"}, status=400)

    written = await sync_to_async(_append_sync, thread_sensitive=True)(session, turns)
    return JsonResponse({"written": written}, status=201)


def _append_sync(session: InterviewSession, turns: list) -> int:
    rows = []
    for turn in turns:
        speaker = turn.get("speaker")
        text = str(turn.get("text") or "").strip()
        # A turn with no speaker we recognise, or nothing said, is not a turn. Dropped
        # rather than rejected: one malformed entry must not lose the rest of a session's
        # conversation.
        if speaker not in TranscriptTurn.Speaker.values or not text:
            continue
        at = turn.get("atSeconds")
        rows.append(
            TranscriptTurn(
                session=session,
                speaker=speaker,
                text=text,
                at_seconds=at if isinstance(at, int) and at >= 0 else 0,
            )
        )
    TranscriptTurn.objects.bulk_create(rows)
    return len(rows)
