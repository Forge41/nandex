"""Assembling the session from whatever providers are actually configured.

The interviewer speaks and listens when there is a speech provider for each. When there
is not, it still joins and still says everything it would have said -- as text, which the
live transcript panel already renders.

Silence would be worse than text. A candidate looking at a plan with an interviewer who
never arrives cannot tell a missing API key from a broken product.
"""

import asyncio
import logging
import os
from dataclasses import dataclass

import anthropic as anthropic_sdk
from livekit.agents import AgentSession, RoomInputOptions, RoomOutputOptions
from livekit.agents.tts import TTS, FallbackAdapter
from livekit.agents.voice import events
from livekit.agents.voice.turn import InterruptionOptions, TurnHandlingOptions
from livekit.plugins import anthropic, cartesia, deepgram

from interviewer import core_client, speech_keys
from interviewer.config import settings
from interviewer.speech_keys import SpeechKey

logger = logging.getLogger("interviewer.voice")


@dataclass(frozen=True)
class Modality:
    """Which half of the conversation can be spoken."""

    can_hear: bool
    can_speak: bool

    @property
    def voice(self) -> bool:
        return self.can_hear and self.can_speak

    def describe(self) -> str:
        if self.voice:
            return "voice"
        missing = [
            name
            for name, present in (
                ("DEEPGRAM_API_KEY", self.can_hear),
                ("CARTESIA_API_KEY", self.can_speak),
            )
            if not present
        ]
        return f"text only ({' and '.join(missing)} not set)"


def available() -> Modality:
    return Modality(
        can_hear=bool(os.getenv("DEEPGRAM_API_KEY")),
        can_speak=bool(speech_keys.configured()),
    )


async def prepare_speech(modality: Modality, voice_id: str) -> tuple[Modality, list[SpeechKey]]:
    """Picks the keys this call will speak with, and reports the ones that can't."""
    if not modality.voice:
        return modality, []
    selection = await speech_keys.select(voice_id)
    remaining = len(selection.chain)
    for key, health in selection.newly_dead:
        await core_client.report_speech_key(key.hint, health.value, remaining)
    if not selection.chain:
        logger.error("No Cartesia key can speak; this call is text only")
        return Modality(can_hear=modality.can_hear, can_speak=False), []
    if selection.chain[0].layer > 1:
        logger.warning("Speaking on %s", selection.chain[0].name)
    return modality, selection.chain


def speech_tts(chain: list[SpeechKey], voice_id: str) -> TTS:
    voices = [cartesia.TTS(api_key=k.value, voice=voice_id) for k in chain]
    # No retries on a key: a 402 is not retryable, and anything that is should move on to
    # the next account rather than make the visitor wait on this one.
    return voices[0] if len(voices) == 1 else FallbackAdapter(voices, max_retry_per_tts=0)


def build_session(
    vad, modality: Modality, voice_id: str = "", chain: list[SpeechKey] | None = None
) -> AgentSession:
    """Both halves or neither.

    Hearing without speaking is an interviewer that listens in silence; speaking without
    hearing is one that talks over the candidate and never responds. Either is worse than
    a conversation both sides can read.
    """
    # The SDK builds its own transport. The plugin would otherwise hand it an httpx
    # client, and this version of the Anthropic SDK is on httpx2 -- passing the client
    # in is the plugin's own way out of that.
    llm = anthropic.LLM(
        model=settings.model,
        api_key=settings.anthropic_api_key,
        client=anthropic_sdk.AsyncClient(api_key=settings.anthropic_api_key),
    )
    if not modality.voice:
        return AgentSession(llm=llm)

    return AgentSession(
        vad=vad,
        stt=deepgram.STT(model=settings.stt_model, language="en"),
        llm=llm,
        # Cartesia. Deepgram does text-to-speech too, on the key transcription already
        # uses, and it was tried -- one provider, one balance. Aura's voices were not
        # good enough, so this stays a second account to keep topped up, which is the
        # cost of the better voice rather than an oversight.
        tts=speech_tts(chain or speech_keys.configured(), voice_id or settings.voice_id),
        # Interruptions from the local VAD rather than LiveKit Cloud's adaptive service,
        # which a self-hosted deployment has no credentials for: left to choose, the
        # session tries it three times per job and logs a 401 each time before falling
        # back here anyway.
        turn_handling=TurnHandlingOptions(interruption=InterruptionOptions(mode="vad")),
    )


def room_options(modality: Modality) -> tuple[RoomInputOptions, RoomOutputOptions]:
    """Text is always on, both ways.

    In: the side panel has a box to type in, and a candidate whose microphone was refused
    must still be able to ask about their plan. Out: transcriptions are what the live
    transcript renders, spoken or not.
    """
    return (
        RoomInputOptions(text_enabled=True, audio_enabled=modality.voice),
        RoomOutputOptions(transcription_enabled=True, audio_enabled=modality.voice),
    )


# Nothing about a session gets better by retrying these: the key is wrong, or the account
# cannot synthesise. Anything else -- a timeout, a 5xx, a dropped connection -- is worth
# another utterance.
_PERMANENT_SPEECH_FAILURES = frozenset({401, 402, 403})


def is_permanent(error: object) -> bool:
    return getattr(error, "status_code", None) in _PERMANENT_SPEECH_FAILURES


def drop_to_text(session, reason: str) -> None:
    """Stop trying to speak, once, and leave the transcript running.

    A credit-exhausted account used to throw on every utterance while the interviewer sat
    in the room saying nothing -- which reads as an agent that never joined, not as a
    provider that stopped working. Text is what the room already falls back to when there
    is no key at all; this is the same outcome, arrived at later.
    """
    if not session.output.audio_enabled:
        return
    session.output.set_audio_enabled(False)
    logger.error("Speech is off for the rest of this interview: %s", reason)


def watch_speech(session: AgentSession, chain: list[SpeechKey]) -> None:
    """Mid-call: a key that stops speaking is reported and the chain moves on; when none
    is left, the call carries on as text."""
    tts = session.tts
    if isinstance(tts, FallbackAdapter):
        # The adapter keeps its instances in the order it was given them: the chain's.
        by_instance = dict(zip(map(id, tts._tts_instances), chain, strict=True))
        down: set[int] = set()
        reports: set[asyncio.Task] = set()

        def _changed(event) -> None:
            key = by_instance.get(id(event.tts))
            if key is None:
                return
            if event.available:
                down.discard(key.layer)
                return
            down.add(key.layer)
            # Re-probed on the next call, which is what decides out of credits or a blip.
            speech_keys.forget(key)
            task = asyncio.create_task(
                core_client.report_speech_key(key.hint, "stopped mid-call", len(chain) - len(down))
            )
            reports.add(task)
            task.add_done_callback(reports.discard)

        tts.on("tts_availability_changed", _changed)

    @session.on("error")
    def _speech_failed(event: events.ErrorEvent) -> None:
        if not isinstance(event.source, TTS):
            return
        if is_permanent(event.error) or isinstance(event.source, FallbackAdapter):
            drop_to_text(session, repr(event.error))
