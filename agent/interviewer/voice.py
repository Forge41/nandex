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
from livekit.plugins import anthropic, cartesia, deepgram

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
        missing = [
            name
            for name, present in (("DEEPGRAM_API_KEY", self.can_hear), ("CARTESIA_API_KEY", self.can_speak))
            if not present
        ]
        return f"text only ({' and '.join(missing)} not set)"


def available() -> Modality:
    return Modality(
        can_hear=bool(os.getenv("DEEPGRAM_API_KEY")),
        can_speak=bool(os.getenv("CARTESIA_API_KEY")),
    )


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
        stt=deepgram.STT(model="nova-3", language="en"),
        llm=llm,
        tts=cartesia.TTS(voice=settings.voice_id),
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
