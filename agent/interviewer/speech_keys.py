"""Up to five Cartesia keys, tried in order: CARTESIA_API_KEY, then CARTESIA_API_KEY_2 to _5.

Each key is a separate account's free credit. Before a call starts, the keys are probed
with a one-word synthesis until one speaks; keys that answer 401/402/403 are skipped and
reported to core, which emails the owner. The key that spoke and every key after it go to
the session as a fallback chain, so a balance that runs out mid-call moves on to the next
account instead of going silent.
"""

import asyncio
import logging
import os
import time
from dataclasses import dataclass
from enum import StrEnum

import httpx

logger = logging.getLogger("interviewer.speech_keys")

LAYERS = 5
PROBE_URL = "https://api.cartesia.ai/tts/bytes"
# The plugin's default model, so a probe measures the account the session will use.
PROBE_MODEL = "sonic-3"
PROBE_TIMEOUT_SECONDS = 5.0
# Per worker process. A good key is re-probed after this long; a dead one after
# DEAD_TTL, since a topped-up account should come back without a restart.
GOOD_TTL_SECONDS = 600
DEAD_TTL_SECONDS = 3600


def env_name(layer: int) -> str:
    return "CARTESIA_API_KEY" if layer == 1 else f"CARTESIA_API_KEY_{layer}"


@dataclass(frozen=True)
class SpeechKey:
    layer: int
    value: str

    @property
    def name(self) -> str:
        return env_name(self.layer)

    @property
    def hint(self) -> str:
        """Enough to tell keys apart in an email, never enough to use one."""
        return f"{self.name} (…{self.value[-4:]})"


class Health(StrEnum):
    OK = "ok"
    EXHAUSTED = "out of credits"
    REJECTED = "rejected"
    # Timeouts and 5xx: nothing is known about the account, so the key stays in the chain.
    UNKNOWN = "unreachable"

    @property
    def dead(self) -> bool:
        return self in (Health.EXHAUSTED, Health.REJECTED)


def configured() -> list[SpeechKey]:
    keys = []
    for layer in range(1, LAYERS + 1):
        value = os.getenv(env_name(layer), "").strip()
        if value:
            keys.append(SpeechKey(layer, value))
    return keys


def classify(status: int | None) -> Health:
    if status is None:
        return Health.UNKNOWN
    if 200 <= status < 300:
        return Health.OK
    if status == 402:
        return Health.EXHAUSTED
    if status in (401, 403):
        return Health.REJECTED
    return Health.UNKNOWN


async def probe(key: SpeechKey, voice_id: str) -> Health:
    try:
        async with httpx.AsyncClient(timeout=PROBE_TIMEOUT_SECONDS) as client:
            response = await client.post(
                PROBE_URL,
                headers={"X-API-Key": key.value, "Cartesia-Version": "2025-04-16"},
                json={
                    "model_id": PROBE_MODEL,
                    "transcript": "ok",
                    "voice": {"mode": "id", "id": voice_id},
                    "output_format": {
                        "container": "raw",
                        "encoding": "pcm_s16le",
                        "sample_rate": 8000,
                    },
                },
            )
    except httpx.HTTPError:
        return Health.UNKNOWN
    return classify(response.status_code)


_seen: dict[int, tuple[Health, float]] = {}
_lock = asyncio.Lock()


def _cached(key: SpeechKey, now: float) -> Health | None:
    hit = _seen.get(key.layer)
    if not hit:
        return None
    health, at = hit
    ttl = DEAD_TTL_SECONDS if health.dead else GOOD_TTL_SECONDS
    return health if now - at < ttl else None


def mark(key: SpeechKey, health: Health) -> None:
    _seen[key.layer] = (health, time.monotonic())


def forget(key: SpeechKey) -> None:
    _seen.pop(key.layer, None)


@dataclass
class Selection:
    chain: list[SpeechKey]
    newly_dead: list[tuple[SpeechKey, Health]]


async def select(voice_id: str, keys: list[SpeechKey] | None = None) -> Selection:
    """The chain to speak with, first key first. Probing stops at the first key that
    speaks, so a healthy first layer costs one probe per GOOD_TTL, not five."""
    keys = configured() if keys is None else keys
    chain: list[SpeechKey] = []
    newly_dead: list[tuple[SpeechKey, Health]] = []
    async with _lock:
        now = time.monotonic()
        spoke = False
        for key in keys:
            health = _cached(key, now)
            if health is None and not spoke:
                health = await probe(key, voice_id)
                was_dead = key.layer in _seen and _seen[key.layer][0].dead
                mark(key, health)
                if health.dead and not was_dead:
                    newly_dead.append((key, health))
            if health is not None and health.dead:
                continue
            chain.append(key)
            spoke = spoke or health is Health.OK
    return Selection(chain, newly_dead)


def reset() -> None:
    _seen.clear()
