"""One LiveKit worker, two roles: the interviewer that talks a candidate through their
plan, and the portfolio's voice guide.

Dispatched explicitly. tps puts the agent's name and metadata in the join token's
roomConfig, so a room only gets this worker when a token asked for it -- it never joins a
room on its own. The metadata decides the role (see interviewer.dispatch).
"""

import asyncio
import logging

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    JobContext,
    JobProcess,
    WorkerOptions,
    cli,
)
from livekit.agents.tts import TTS
from livekit.agents.voice import events
from livekit.plugins import silero

from interviewer import core_client, dispatch, portfolio, voice
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


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect()

    role = dispatch.parse(ctx.job.metadata or "")
    if role is None:
        logger.error("The dispatch named no role; leaving room %s", ctx.room.name)
        return
    if role.mode == dispatch.PORTFOLIO:
        await portfolio.run(ctx, role)
        return
    await interview(ctx, role.session_id)


async def interview(ctx: JobContext, session_id: str) -> None:
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

    @session.on("error")
    def _speech_failed(event: events.ErrorEvent) -> None:
        # Only speaking. A transcription failure leaves the candidate able to type, and
        # an LLM failure is the session's own to retry.
        if isinstance(event.source, TTS) and voice.is_permanent(event.error):
            voice.drop_to_text(session, repr(event.error))

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
