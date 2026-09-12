"""The interviewer: a LiveKit agent that joins the room and talks about the plan.

Dispatched explicitly. tps puts the agent's name and the session id in the join token's
roomConfig, so a room only gets an interviewer when a candidate's token asked for one --
this worker never joins a room on its own.
"""

import asyncio
import json
import logging

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.agents.voice import events
from livekit.plugins import silero

from interviewer import core_client, voice
from interviewer.briefing import greeting_instruction, instructions_for
from interviewer.config import settings
from interviewer.transcript import TranscriptRecorder

load_dotenv(dotenv_path=core_client.settings.model_config["env_file"], override=False)

logger = logging.getLogger("interviewer")

# How often the conversation so far is handed to core. Long enough that it is nowhere near
# the conversation's own latency, short enough that a crash costs a sentence or two.
FLUSH_SECONDS = 30


def prewarm(proc: JobProcess) -> None:
    """Loads the voice-activity model once per worker process rather than per job: it is
    the slowest thing to start, and a candidate waiting on it is waiting in silence."""
    proc.userdata["vad"] = silero.VAD.load()


def _session_id(ctx: JobContext) -> str | None:
    """The session this room belongs to, from the dispatch core asked for.

    Read off the job rather than the room name: the name's format is core's business, and
    parsing it here would make a rename in core a silent break in the agent.
    """
    raw = ctx.job.metadata or ""
    if not raw:
        return None
    try:
        return json.loads(raw).get("session_id")
    except json.JSONDecodeError:
        logger.warning("Dispatch metadata was not JSON: %r", raw[:200])
        return None


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    session_id = _session_id(ctx)
    if session_id is None:
        logger.error("No session id in the dispatch; leaving room %s", ctx.room.name)
        return

    try:
        brief = await core_client.fetch_brief(session_id)
    except core_client.CoreUnavailable:
        # Nothing useful can be said without the plan, and saying something generic would
        # be an interviewer who has not read the resume it claims to have read.
        logger.exception("Couldn't load the brief for %s; leaving", session_id)
        return

    modality = voice.available()
    if not modality.voice:
        # Loud, because this is a product decision made by a missing environment variable.
        logger.warning(
            "Interviewing in %s -- the candidate will read, not hear", modality.describe()
        )
    session = voice.build_session(ctx.proc.userdata["vad"], modality)

    recorder = TranscriptRecorder(session_id)

    @session.on("conversation_item_added")
    def _remember(event: events.ConversationItemAddedEvent) -> None:
        recorder.add(event.item)

    async def _flush() -> None:
        pending = recorder.pending()
        if not pending:
            return
        recorder.mark_flushed(await core_client.save_transcript(session_id, pending))

    async def _flush_periodically() -> None:
        while True:
            await asyncio.sleep(FLUSH_SECONDS)
            await _flush()

    flushing = asyncio.create_task(_flush_periodically())

    async def _save() -> None:
        flushing.cancel()
        await _flush()
        logger.info("Transcript saved for %s", session_id)

    ctx.add_shutdown_callback(_save)

    room_input, room_output = voice.room_options(modality)
    await session.start(
        agent=Agent(instructions=instructions_for(brief)),
        room=ctx.room,
        room_input_options=room_input,
        room_output_options=room_output,
    )

    await session.generate_reply(instructions=greeting_instruction(brief))


def main() -> None:
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm,
            # Explicit dispatch. Without a name here the worker would take every room on
            # the LiveKit deployment, including rooms that never asked for an interviewer.
            agent_name=settings.agent_name,
        )
    )


if __name__ == "__main__":
    main()
