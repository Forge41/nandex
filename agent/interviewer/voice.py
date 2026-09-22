"""Assembling the session from whatever providers are actually configured.

The interviewer speaks and listens when there is a speech provider for each. When there
is not, it still joins and still says everything it would have said -- as text, which the
live transcript panel already renders.

Silence would be worse than text. A candidate looking at a plan with an interviewer who
never arrives cannot tell a missing API key from a broken product.
"""

import logging
import os
from dataclasses import dataclass

import anthropic as anthropic_sdk
from livekit.agents import AgentSession, RoomInputOptions, RoomOutputOptions
from livekit.agents.voice.turn import InterruptionOptions, TurnHandlingOptions
from livekit.plugins import anthropic, deepgram

from interviewer.config import settings

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
        return "text only (DEEPGRAM_API_KEY not set)"


def available() -> Modality:
    """One key, both halves.

    Deepgram does speech-to-text and text-to-speech, so hearing and speaking stand or
    fall together -- which is what `build_session` wants anyway.
    """
    configured = bool(os.getenv("DEEPGRAM_API_KEY"))
    return Modality(can_hear=configured, can_speak=configured)


def build_session(vad, modality: Modality) -> AgentSession:
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
        # Aura, on the same key and the same account as the transcription above. This
        # was Cartesia until that account ran out of credit, which is a failure worth
        # naming: a second speech provider is a second balance to keep topped up, and
        # nothing about the product needed one.
        tts=deepgram.TTS(model=settings.voice_model),
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
