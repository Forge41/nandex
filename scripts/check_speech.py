"""Asks whether the speech keys in backend/.env can actually hear and speak.

**The endpoints that bill, not ones that merely authenticate.** This used to probe
Cartesia's `GET /voices`, which answers 200 on an account with no credit left, while
every attempt to synthesise answered 402 -- so it reported an interviewer that would
speak, against an account that could not say a word. A check that cannot fail the way
the product fails is not a check.

So each probe does the real work: one word synthesised through Cartesia, one clip of
real speech transcribed by Deepgram. `make doctor` can only see that something is set;
this is the difference between set, authenticating, and working.

Never prints a key. The whole point of checking them here is that they do not have to be
echoed anywhere to be tested.
"""

import json
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ENV = Path(__file__).resolve().parents[1] / "backend" / ".env"

GREEN, YELLOW, RED, DIM, OFF = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"

DEEPGRAM_CONSOLE = "https://console.deepgram.com/"
CARTESIA_CONSOLE = "https://play.cartesia.ai/keys"

# Kept in step with agent/interviewer/config.py by hand, which is the usual reason two
# copies drift -- but the agent must not be importable from here, and a check against a
# different model than the one that runs is worse than this.
CARTESIA_MODEL = "sonic-2"
CARTESIA_VOICE = "6f84f4b8-58a2-430c-8c79-688dad597532"
STT_MODEL = "nova-3"

SPEAK = "Good to meet you."


def load() -> dict[str, str]:
    if not ENV.exists():
        return {}
    values = {}
    for line in ENV.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip()
    return values


def post(url: str, headers: dict[str, str], body: bytes) -> tuple[bytes | None, str]:
    request = Request(url, data=body, headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            return response.read(), f"HTTP {response.status}"
    except HTTPError as e:
        if e.code in (401, 403):
            return None, "the key was rejected"
        if e.code == 402:
            # The one this script exists for: a valid key on an account that is out of
            # credit. Different from a wrong key, and it needs a different action.
            return None, "the key is valid but the account is out of credit"
        return None, f"HTTP {e.code}"
    except URLError as e:
        return None, f"could not reach it ({e.reason})"


def check_speaking(key: str) -> tuple[bytes | None, str]:
    """Synthesis itself, because that is what an exhausted account refuses."""
    audio, detail = post(
        "https://api.cartesia.ai/tts/bytes",
        {
            "X-API-Key": key,
            "Cartesia-Version": "2024-06-10",
            "Content-Type": "application/json",
        },
        json.dumps(
            {
                "model_id": CARTESIA_MODEL,
                "transcript": SPEAK,
                "voice": {"mode": "id", "id": CARTESIA_VOICE},
                "output_format": {
                    "container": "wav",
                    "encoding": "pcm_s16le",
                    "sample_rate": 24000,
                },
            }
        ).encode(),
    )
    if audio is None:
        return None, detail
    if not audio:
        return None, "it answered without any audio"
    return audio, f"{len(audio)} bytes of audio"


def check_hearing(key: str, audio: bytes) -> tuple[bool, str]:
    """The other provider's speech, read back. An end-to-end check needs no fixture."""
    body, detail = post(
        f"https://api.deepgram.com/v1/listen?model={STT_MODEL}&smart_format=true",
        {"Authorization": f"Token {key}", "Content-Type": "audio/wav"},
        audio,
    )
    if body is None:
        return False, detail
    try:
        alternative = json.loads(body)["results"]["channels"][0]["alternatives"][0]
    except (ValueError, KeyError, IndexError):
        return False, "the response was not a transcript"
    heard = (alternative.get("transcript") or "").strip()
    if not heard:
        return False, "it transcribed silence"
    return True, f"heard {heard!r}"


def main() -> int:
    env = load()
    speaking_key = env.get("CARTESIA_API_KEY", "")
    hearing_key = env.get("DEEPGRAM_API_KEY", "")

    audio = None
    if not speaking_key:
        print(f"{YELLOW}○ Speaking{OFF}  CARTESIA_API_KEY is not set")
        print(f"    {DIM}get one at {CARTESIA_CONSOLE}{OFF}")
    else:
        audio, detail = check_speaking(speaking_key)
        if audio is None:
            print(f"{RED}✗ Speaking{OFF}  {detail}")
            print(f"    {DIM}check it at {CARTESIA_CONSOLE}{OFF}")
        else:
            print(f"{GREEN}✓ Speaking{OFF}  {CARTESIA_MODEL} returned {detail}")

    if not hearing_key:
        print(f"{YELLOW}○ Hearing{OFF}  DEEPGRAM_API_KEY is not set")
        print(f"    {DIM}get one at {DEEPGRAM_CONSOLE}{OFF}")
    elif audio is None:
        # Nothing was synthesised, so there is nothing to read back. Saying so beats
        # passing a check that never ran.
        print(f"{YELLOW}○ Hearing{OFF}  not checked -- it reads back what was spoken")
    else:
        ok, detail = check_hearing(hearing_key, audio)
        if ok:
            print(f"{GREEN}✓ Hearing{OFF}  {STT_MODEL} {detail}")
        else:
            print(f"{RED}✗ Hearing{OFF}  {detail}")
            print(f"    {DIM}check it at {DEEPGRAM_CONSOLE}{OFF}")

    print()
    # The interviewer needs both: hearing without speaking listens in silence, speaking
    # without hearing talks over the candidate. build_session refuses either half.
    if audio is not None and hearing_key:
        print(f"{GREEN}The interviewer will speak and listen.{OFF}")
    else:
        print(
            f"{DIM}The interviewer still runs -- it says everything it would have said,"
            f" as text in the transcript panel.{OFF}"
        )
    # Zero either way: text-only is a working configuration, not a broken one.
    return 0


if __name__ == "__main__":
    sys.exit(main())
