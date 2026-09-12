"""Asks Deepgram and Cartesia whether the keys in backend/.env actually work.

A real request to each, because the failure this catches is a key that is present and
wrong -- pasted with a space, revoked, or from the wrong account. `make doctor` can only
see that something is set; this is the difference between set and working.

Never prints a key. The whole point of checking them here is that they do not have to be
echoed anywhere to be tested.
"""

import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ENV = Path(__file__).resolve().parents[1] / "backend" / ".env"

GREEN, YELLOW, RED, DIM, OFF = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"

CHECKS = {
    "DEEPGRAM_API_KEY": (
        "Deepgram (speech in)",
        "https://api.deepgram.com/v1/projects",
        lambda key: {"Authorization": f"Token {key}"},
        "https://console.deepgram.com/",
    ),
    "CARTESIA_API_KEY": (
        "Cartesia (speech out)",
        "https://api.cartesia.ai/voices",
        lambda key: {"X-API-Key": key, "Cartesia-Version": "2024-06-10"},
        "https://play.cartesia.ai/keys",
    ),
}


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


def probe(url: str, headers: dict) -> tuple[bool, str]:
    try:
        with urlopen(Request(url, headers=headers), timeout=15) as response:
            return response.status == 200, f"HTTP {response.status}"
    except HTTPError as e:
        if e.code in (401, 403):
            return False, "the key was rejected"
        return False, f"HTTP {e.code}"
    except URLError as e:
        return False, f"could not reach it ({e.reason})"


def main() -> int:
    env = load()
    failures = 0

    for name, (label, url, headers_for, console) in CHECKS.items():
        key = env.get(name, "")
        if not key:
            print(f"{YELLOW}○ {label}{OFF}  {name} is not set")
            print(f"    {DIM}get one at {console}{OFF}")
            failures += 1
            continue

        ok, detail = probe(url, headers_for(key))
        if ok:
            print(f"{GREEN}✓ {label}{OFF}  the key works")
        else:
            print(f"{RED}✗ {label}{OFF}  {detail}")
            print(f"    {DIM}check it at {console}{OFF}")
            failures += 1

    print()
    if failures:
        print(
            f"{DIM}The interviewer still runs with these missing -- it says everything it"
            f" would have said, as text in the transcript panel.{OFF}"
        )
    else:
        print(f"{GREEN}The interviewer will speak and listen.{OFF}")
    # Zero either way: text-only is a working configuration, not a broken one.
    return 0


if __name__ == "__main__":
    sys.exit(main())
