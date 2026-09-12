"""How the request/response side reaches a session's workflow.

The client is held for the process rather than built per call: the browser polls plan
progress about once a second while a resume is being read, and a fresh Client.connect
per poll is a TCP handshake and a namespace lookup per second.

Nothing here raises. A worker that is down must not turn a page load into a 500 -- the
durable answer to "is this ready" lives on the session row, and these calls only ever
add detail to it.
"""

import asyncio
import logging

from temporalio.client import Client, WorkflowHandle
from temporalio.service import RPCError

from apps.interview.config import settings

logger = logging.getLogger(__name__)

_client: Client | None = None
_connecting = asyncio.Lock()


def workflow_id_for(session_id: str) -> str:
    return f"interview-session-{session_id}"


async def _connect() -> Client | None:
    global _client
    if _client is not None:
        return _client
    async with _connecting:
        if _client is None:
            try:
                _client = await Client.connect(settings.temporal_address)
            except Exception:
                logger.warning("Couldn't reach Temporal at %s", settings.temporal_address)
                return None
    return _client


async def _handle(session_id: str) -> WorkflowHandle | None:
    client = await _connect()
    return None if client is None else client.get_workflow_handle(workflow_id_for(session_id))


async def start_plan(session_id: str, document_id: str) -> bool:
    """Starts the session's workflow on the resume it was given.

    The id is the session's, so a resubmitted upload joins the run already in flight
    rather than paying for the plan twice.
    """
    client = await _connect()
    if client is None:
        return False
    try:
        await client.start_workflow(
            "InterviewSessionWorkflow",
            args=[session_id, document_id],
            id=workflow_id_for(session_id),
            task_queue=settings.temporal_task_queue,
        )
        return True
    except Exception:
        logger.warning("Couldn't start the plan workflow for %s", session_id, exc_info=True)
        return False


async def _signal(session_id: str, name: str, *args) -> None:
    handle = await _handle(session_id)
    if handle is None:
        return
    try:
        await handle.signal(name, *args)
    except RPCError:
        # No workflow for this session: one is only started by a resume upload, so there
        # is genuinely nothing generating and nothing to tell.
        logger.debug("No workflow to signal %s for %s", name, session_id)
    except Exception:
        logger.warning("Couldn't signal %s for %s", name, session_id, exc_info=True)


async def round_reached(session_id: str, stage_id: str) -> None:
    await _signal(session_id, "round_reached", stage_id)


async def session_ended(session_id: str) -> None:
    await _signal(session_id, "session_ended")


async def plan_progress(session_id: str) -> dict | None:
    """The live step list, or None when the workflow cannot answer.

    None covers a worker that is down and a run whose history has aged out -- both of
    which the caller answers from the session row instead.
    """
    handle = await _handle(session_id)
    if handle is None:
        return None
    try:
        return await handle.query("progress")
    except Exception:
        logger.debug("Couldn't query plan progress for %s", session_id, exc_info=True)
        return None
