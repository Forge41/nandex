"""A development shortcut to any round, without sitting the ones before it.

Mounted only when `DEBUG` is on -- `config/urls.py` does not include this module
otherwise, so the route does not exist in a deployed system rather than existing and
refusing. A bypass that is merely guarded is one misconfiguration away from being a way
into somebody else's interview.

Created through the browser deliberately, rather than by a management command: a session
belongs to the user behind the request's cookie, and one made on the command line belongs
to nobody the browser can be. That was the friction this replaces -- every hand-made dev
session had to be reassigned to whichever user the browser had been given.

What it seeds is marked as seeded. The coding and SQL rounds get real tasks from the bank,
because those are real either way; the conversation rounds get content that says on its
face that a person did not write it. Nothing here is reachable by a candidate, but content
that looks generated is how something fabricated ends up being believed later.
"""

import logging

from asgiref.sync import sync_to_async
from django.http import HttpRequest, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from apps.core.api.views import _require_user
from apps.interview import services, task_bank
from apps.interview.api.views import _default_project_sync, _parse_body, _serialized
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts
from apps.interview.rounds import STAGE_IDS

logger = logging.getLogger(__name__)

SEEDED_BY = "Seeded by the dev bypass -- not generated from a resume."


@csrf_exempt
async def dev_session(request: HttpRequest) -> JsonResponse:
    """Creates a session sitting at `stage`, with whatever that round needs to render."""
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    user = await sync_to_async(_require_user)(request)
    if user is None:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    body = _parse_body(request)
    stage = str(body.get("stage") or "coding")
    if stage not in STAGE_IDS:
        return JsonResponse(
            {"detail": f"Unknown or unshipped stage: {stage}", "stages": list(STAGE_IDS)},
            status=400,
        )

    project = await sync_to_async(_default_project_sync, thread_sensitive=True)(user)
    if project is None:
        return JsonResponse({"detail": "No project for this user"}, status=400)

    session = await services.create_session(project.id, user.id, "Senior Backend Engineer")
    await sync_to_async(_seed_sync, thread_sensitive=True)(session.id, stage, body)
    session = await InterviewSession.objects.aget(id=session.id)
    return JsonResponse(await _serialized(session), status=201)


def _seed_sync(session_id: str, stage: str, body: dict) -> None:
    language = str(body.get("language") or "python")

    ResumeFacts.objects.update_or_create(
        session_id=session_id,
        defaults={
            "file_name": "dev-bypass.txt",
            "page_count": 1,
            "candidate_name": "Dev Candidate",
            "candidate_title": "Senior Backend Engineer",
            "candidate_years_experience": 7,
            "sections": [{"heading": "Experience", "paragraphs": [[{"text": SEEDED_BY}]]}],
            "probes": [],
            "citations": [],
        },
    )

    for round_ in InterviewRound.objects.filter(session_id=session_id):
        content = _content_for(round_.stage_id, language)
        if content is None:
            continue
        round_.content = content
        round_.content_state = InterviewRound.ContentState.READY
        round_.save(update_fields=["content", "content_state"])

    session = InterviewSession.objects.get(id=session_id)
    session.active_stage = stage
    session.progress_index = STAGE_IDS.index(stage)
    session.plan_state = InterviewSession.PlanState.READY
    session.status = InterviewSession.Status.ACTIVE
    # Started too, so the timer reads as a session in progress rather than one that has
    # been open for zero seconds.
    session.started_at = timezone.now()
    # Consent, so the rounds that check it behave as they would for a candidate who
    # agreed rather than silently taking the declined path.
    session.consent_recording = True
    session.consent_ai_interviewer = True
    session.consent_integrity_monitoring = True
    session.candidate_name = "Dev Candidate"
    session.save()


def _content_for(stage_id: str, language: str) -> dict | None:
    if stage_id == "coding":
        return _bank_content(2, language)
    if stage_id == "sql":
        # Not from the bank: it holds Exercism exercises, none of which have a SQL
        # variant, so asking it for one would put a Python task in the SQL round.
        return _SQL_TASK
    if stage_id == "behavioral":
        return {
            "questionNumber": 1,
            "question": "Walk me through a system you owned that failed in production.",
            "derivedFrom": [SEEDED_BY],
        }
    return None


_SQL_TASK = {
    "tasks": [
        {
            "index": 1,
            "total": 1,
            "title": "Settled totals by merchant",
            "prompt": (
                "For each merchant, return the total settled amount in cents, ordered by "
                "merchant. " + SEEDED_BY
            ),
            "schema": [
                {
                    "name": "transfers",
                    "columns": [
                        {"name": "id", "type": "int"},
                        {"name": "merchant", "type": "text"},
                        {"name": "cents", "type": "int"},
                    ],
                }
            ],
            "attemptsAllowed": 3,
            "defaultLanguage": "sql",
            "tests": [
                {"name": "query runs", "hidden": False},
                {"name": "result matches", "hidden": False},
            ],
            "languages": {
                "sql": {
                    "tests": [
                        {"name": "query runs", "hidden": False},
                        {"name": "result matches", "hidden": False},
                    ],
                    "files": [
                        {
                            "name": "query.sql",
                            "language": "sql",
                            "content": "SELECT merchant\nFROM transfers\n-- your answer here\n",
                        },
                        {
                            "name": "schema.sql",
                            "language": "sql",
                            "content": (
                                "CREATE TABLE transfers(id int, merchant text, cents int);\n"
                                "INSERT INTO transfers VALUES "
                                "(1,'acme',100),(2,'acme',250),(3,'globex',80);\n"
                            ),
                            "hidden": True,
                        },
                        {
                            "name": "expected.csv",
                            "language": "sql",
                            "content": "merchant,total\nacme,350\nglobex,80\n",
                            "hidden": True,
                        },
                    ],
                }
            },
        }
    ],
    "defaultLanguage": "sql",
}


def _bank_content(count: int, language: str) -> dict | None:
    """Real tasks, because the bank's are real whoever asked for them."""
    tasks = task_bank.pick(count, seed="dev-bypass", language=language)
    if not tasks:
        return None
    prepared = []
    for index, task in enumerate(tasks):
        available = list(task.get("languages") or {})
        if not available:
            continue
        prepared.append(
            {
                **task,
                "index": index + 1,
                "total": len(tasks),
                "defaultLanguage": language if language in available else available[0],
            }
        )
    if not prepared:
        return None
    return {"tasks": prepared, "defaultLanguage": prepared[0]["defaultLanguage"]}
