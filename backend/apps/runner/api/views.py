"""The runner's only endpoint.

Server-sent events rather than a JSON reply, because the candidate is watching the output
appear and a ten-second wait for a complete document is a worse version of the same
information.
"""

import json
import logging
import threading

from django.http import HttpRequest, HttpResponse, JsonResponse, StreamingHttpResponse
from django.views.decorators.csrf import csrf_exempt

from apps.runner import languages, sandbox
from apps.runner.config import settings
from apps.runner.deps import has_service_token

logger = logging.getLogger(__name__)

# Admission control, not queueing. A run that waited in a queue and then hit its budget is
# reported to the candidate as their own code being slow, which is a lie about their
# solution -- so a busy runner refuses immediately and says why.
_slots = threading.Semaphore(settings.max_concurrent_runs)


@csrf_exempt
def runs(request: HttpRequest) -> HttpResponse:
    if not has_service_token(request):
        return JsonResponse({"detail": "Authentication required"}, status=401)
    if request.method != "POST":
        return JsonResponse({"detail": "Method not allowed"}, status=405)

    try:
        body = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "Body must be JSON"}, status=400)

    language = languages.get(str(body.get("language", "")))
    if language is None:
        return JsonResponse({"detail": "Unknown language"}, status=400)

    files = body.get("files")
    if not isinstance(files, dict) or not files:
        return JsonResponse({"detail": "files is required"}, status=400)

    budgets = body.get("budgets") or {}
    spec = sandbox.RunSpec(
        language=language,
        files={str(name): str(content) for name, content in files.items()},
        compile_ms=int(budgets.get("compileMs") or language.compile_ms),
        run_ms=int(budgets.get("runMs") or language.run_ms),
    )

    if not _slots.acquire(blocking=False):
        return JsonResponse(
            {"detail": "The runner is at capacity. Try again in a moment."}, status=429
        )

    response = StreamingHttpResponse(_stream(spec), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response


def _stream(spec: sandbox.RunSpec):
    """Always ends on `done`, including on every failure path.

    A caller relaying this to a browser has to be able to end its own stream on a
    sentinel rather than on the absence of further output -- otherwise a runner that dies
    mid-run leaves a spinner that never resolves.
    """
    try:
        for event in sandbox.run(spec):
            yield _sse(event["event"], event["data"])
    except sandbox.SandboxUnavailable as e:
        logger.warning("sandbox unavailable for %s: %s", spec.language.id, e)
        yield _sse("done", _unavailable(str(e)))
    except Exception:
        logger.exception("run failed for %s", spec.language.id)
        yield _sse("done", _unavailable("the runner failed"))
    finally:
        _slots.release()


def _unavailable(detail: str) -> dict:
    return {
        "phase": "unavailable",
        "detail": detail,
        "tests": [],
        "exitCode": None,
        "durationMs": 0,
        "truncated": False,
        "timedOut": False,
    }


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"
