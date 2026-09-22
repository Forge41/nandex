"""Asks Deepgram whether the key in backend/.env can actually hear and speak.

**The endpoint that bills, not one that merely authenticates.** This used to probe
Cartesia's `GET /voices`, which answers 200 on an account with no credit left, while
every attempt to synthesise answered 402 -- so it reported an interviewer that would
speak, against an account that could not say a word. A check that cannot fail the way
the product fails is not a check.

So each probe does the real work: one word through text-to-speech, one clip of that
audio back through transcription. `make doctor` can only see that something is set; this
is the difference between set, authenticating, and working.

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

CONSOLE = "https://console.deepgram.com/"

# Kept in step with agent/interviewer/config.py by hand, which is the usual reason two
# copies drift -- but the agent must not be importable from here, and a check against a
# different model than the one that runs is worse than this.
TTS_MODEL = "aura-2-thalia-en"
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


def post(url: str, key: str, body: bytes, content_type: str) -> tuple[bytes | None, str]:
    request = Request(
        url,
        data=body,
        headers={"Authorization": f"Token {key}", "Content-Type": content_type},
    )
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
    audio, detail = post(
        f"https://api.deepgram.com/v1/speak?model={TTS_MODEL}",
        key,
        json.dumps({"text": SPEAK}).encode(),
        "application/json",
    )
    if audio is None:
        return None, detail
    if not audio:
        return None, "it answered without any audio"
    return audio, f"{len(audio)} bytes of audio"


def check_hearing(key: str, audio: bytes) -> tuple[bool, str]:
    """Its own speech, read back. An end-to-end check needs no fixture audio."""
    body, detail = post(
        f"https://api.deepgram.com/v1/listen?model={STT_MODEL}&smart_format=true",
        key,
        audio,
        "audio/mpeg",
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
    key = load().get("DEEPGRAM_API_KEY", "")
    if not key:
        print(f"{YELLOW}○ Deepgram{OFF}  DEEPGRAM_API_KEY is not set")
        print(f"    {DIM}get one at {CONSOLE}{OFF}")
        print()
        print(
            f"{DIM}The interviewer still runs without it -- it says everything it would"
            f" have said, as text in the transcript panel.{OFF}"
        )
        return 0

    audio, detail = check_speaking(key)
    if audio is None:
        print(f"{RED}✗ Speaking{OFF}  {detail}")
        print(f"    {DIM}check it at {CONSOLE}{OFF}")
        print()
        print(f"{DIM}The interviewer will join and write, but not speak.{OFF}")
        return 0
    print(f"{GREEN}✓ Speaking{OFF}  {TTS_MODEL} returned {detail}")

    ok, detail = check_hearing(key, audio)
    if not ok:
        print(f"{RED}✗ Hearing{OFF}  {detail}")
        print(f"    {DIM}check it at {CONSOLE}{OFF}")
        print()
        print(f"{DIM}The interviewer will speak, but not hear the candidate.{OFF}")
        return 0
    print(f"{GREEN}✓ Hearing{OFF}  {STT_MODEL} {detail}")

    print()
    print(f"{GREEN}The interviewer will speak and listen.{OFF}")
    # Zero either way: text-only is a working configuration, not a broken one.
    return 0


if __name__ == "__main__":
    sys.exit(main())
