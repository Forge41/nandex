"""The coding round's endpoints: save a draft, take an attempt, read past attempts.

The run is relayed to the browser as it happens, but it is **not owned** by that
response. Django stops iterating a `StreamingHttpResponse`'s generator once the client
goes away, so a candidate who reloads mid-run would otherwise lose the attempt itself and
not just the view of it. The run is consumed by a worker thread that writes the `CodeRun`;
the response is a tap on that thread's queue.
"""

import json
import logging
import queue
import threading

from asgiref.sync import sync_to_async
from django.http import HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt

from apps.core.clients import runner_client
from apps.interview import coding, round_content
from apps.interview.api.views import _parse_body, _session_for
from apps.interview.models import CodeRun, InterviewRound

logger = logging.getLogger(__name__)

# The rounds that run code. Both use the same machinery -- an attempt, a sandbox, a
# recorded result -- and differ only in which runner image serves them.
RUNNABLE_STAGES = ("coding", "sql")
_SENTINEL = object()


def _stage(stage_id: str) -> str | None:
    return stage_id if stage_id in RUNNABLE_STAGES else None


@csrf_exempt
async def session_draft(request: HttpRequest, session_id: str, stage_id: str) -> HttpResponse:
    session, error = await _session_for(request, session_id)
    if error is not None:
        return error
    if _stage(stage_id) is None:
        return JsonResponse({"detail": "That round does not run code"}, status=404)
    if request.method != "PUT":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    body = _parse_body(request)
    name = str(body.get("name") or "")
    language = str(body.get("language") or "")
    task_index = int(body.get("taskIndex") or 0)

    try:
        await sync_to_async(coding.save_draft, thread_sensitive=True)(
            session_id=session.id,
            stage_id=stage_id,
            task_index=task_index,
            language=language,
            name=name,
            content=str(body.get("content") or ""),
        )
    except coding.TaskMissing:
        return JsonResponse({"detail": "That task has not been generated yet"}, status=404)
    except coding.FileNotEditable:
        # The same refusal that stops a draft named after the test file.
        return JsonResponse({"detail": "That file is not yours to edit"}, status=400)
    return JsonResponse({"saved": True})


@csrf_exempt
async def session_runs(request: HttpRequest, session_id: str, stage_id: str) -> HttpResponse:
    session, error = await _session_for(request, session_id)
    if error is not None:
        return error
    if _stage(stage_id) is None:
        return JsonResponse({"detail": "That round does not run code"}, status=404)

    if request.method == "GET":
        task_index = int(request.GET.get("taskIndex") or 0)
        return JsonResponse(
            await sync_to_async(_past_runs, thread_sensitive=True)(session.id, stage_id, task_index)
        )

    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    body = _parse_body(request)
    language = str(body.get("language") or "")
    task_index = int(body.get("taskIndex") or 0)

    try:
        files = await sync_to_async(coding.runner_payload, thread_sensitive=True)(
            session_id=session.id,
            stage_id=stage_id,
            task_index=task_index,
            language=language,
        )
        run = await sync_to_async(coding.claim_attempt, thread_sensitive=True)(
            session_id=session.id,
            stage_id=stage_id,
            task_index=task_index,
            language=language,
            files=files,
        )
    except coding.TaskMissing:
        return JsonResponse({"detail": "That task has not been generated yet"}, status=404)
    except coding.AttemptsExhausted:
        return JsonResponse({"detail": "No attempts left for this task"}, status=409)

    events: queue.Queue = queue.Queue()
    threading.Thread(target=_consume, args=(run.id, language, files, events), daemon=True).start()

    response = StreamingHttpResponse(_tap(events, run.id), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


def _consume(run_id: str, language: str, files: dict, events: queue.Queue) -> None:
    """Owns the run. Keeps going, and keeps writing, whether or not anyone is watching."""
    run = CodeRun.objects.get(id=run_id)
    terminal: list[dict] = []
    done: dict | None = None
    try:
        for event in runner_client.run(language=language, files=files):
            if event["event"] == "line":
                terminal.append(event["data"])
            if event["event"] == "done":
                done = event["data"]
            events.put(event)
    except runner_client.RunnerBusy as e:
        done = _failed("unavailable", str(e))
        events.put({"event": "done", "data": done})
    except runner_client.RunnerUnavailable as e:
        done = _failed("unavailable", str(e))
        events.put({"event": "done", "data": done})
    except Exception:
        logger.exception("run %s failed", run_id)
        done = _failed("crashed", "The run failed.")
        events.put({"event": "done", "data": done})
    finally:
        try:
            coding.finish(run, done or _failed("crashed", "The run produced no result."), terminal)
        except Exception:
            logger.exception("could not record run %s", run_id)
        events.put(_SENTINEL)


def _tap(events: queue.Queue, run_id: str):
    yield _sse("run", {"runId": run_id})
    while True:
        event = events.get()
        if event is _SENTINEL:
            return
        yield _sse(event["event"], event["data"])


def _failed(phase: str, detail: str) -> dict:
    return {
        "phase": phase,
        "detail": detail,
        "tests": [],
        "exitCode": None,
        "durationMs": 0,
        "truncated": False,
        "timedOut": False,
    }


def _past_runs(session_id: str, stage_id: str, task_index: int) -> dict:
    runs = CodeRun.objects.filter(
        session_id=session_id, stage_id=stage_id, task_index=task_index
    ).order_by("created_at")
    return {
        "runs": [coding.serialize_run(run) for run in runs],
        **coding.attempt_state(session_id, stage_id, task_index),
    }


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@csrf_exempt
async def session_language(
    request: HttpRequest, session_id: str, stage_id: str, task_index: int, language: str
) -> HttpResponse:
    """Generates one language's files for a task the candidate has switched to.

    A route rather than the lookahead, because a switch happens at request time and the
    workflow has no entry point for that. Idempotent: a language already prepared is
    returned rather than paid for twice.
    """
    session, error = await _session_for(request, session_id)
    if error is not None:
        return error
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    round_ = await InterviewRound.objects.filter(session_id=session.id, stage_id=stage_id).afirst()
    if round_ is None:
        return JsonResponse({"detail": "That round does not exist"}, status=404)

    tasks = (round_.content or {}).get("tasks") or []
    if task_index < 0 or task_index >= len(tasks):
        return JsonResponse({"detail": "That task has not been generated yet"}, status=404)

    task = tasks[task_index]
    if _stage(stage_id) is None:
        return JsonResponse({"detail": "That round does not run code"}, status=404)
    if language in (task.get("languages") or {}):
        return JsonResponse({"files": task["languages"][language]["files"]})
    if language not in round_content.coding_generation.LANGUAGE_IDS:
        return JsonResponse({"detail": "Unsupported language"}, status=400)

    try:
        await round_content.attach_language(task, language)
    except round_content.coding_generation.TaskUnusable as e:
        logger.warning("could not prepare %s for %s: %s", language, session.id, e)
        return JsonResponse(
            {"detail": "We could not prepare that language. Try another."}, status=503
        )

    round_.content = {**round_.content, "tasks": tasks}
    await round_.asave(update_fields=["content"])
    return JsonResponse({"files": task["languages"][language]["files"]})
