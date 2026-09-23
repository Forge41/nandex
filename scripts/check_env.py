"""Reports what backend/.env is missing before anything tries to use it.

Not a validator: nothing here fails a build. Most of the stack runs with holes in it --
the interviewer talks in text without speech keys, recordings simply do not happen
without a bucket -- and the point is to say which holes are there, once, instead of
letting each service discover its own at the moment a candidate hits it.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / "backend" / ".env"
EXAMPLE = ROOT / "backend" / ".env.example"

# Secrets nobody can default. The value is what stops working without them, written for
# whoever is reading the warning rather than for whoever wrote the variable.
EXTERNAL = {
    "AI_ANTHROPIC_API_KEY": "no interview plan can be generated from a resume",
    "DEEPGRAM_API_KEY": "the interviewer cannot hear the candidate",
    "CARTESIA_API_KEY": "the interviewer cannot speak",
}

GREEN, YELLOW, RED, DIM, OFF = "\033[32m", "\033[33m", "\033[31m", "\033[2m", "\033[0m"


def load(path: Path) -> dict[str, str]:
    values = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip()
    return values


def main() -> int:
    if not ENV.exists():
        print(f"{RED}backend/.env is missing.{OFF} Copy it: cp backend/.env.example backend/.env")
        return 1

    example, env = load(EXAMPLE), load(ENV)

    # A variable the example fills in is one that has a working local value, so an empty
    # one here is a hole rather than a choice.
    unset = [k for k, v in example.items() if v and not env.get(k)]
    external = [k for k in EXTERNAL if not env.get(k)]

    if not unset and not external:
        print(f"{GREEN}✓ backend/.env has everything, speech included.{OFF}")
        return 0

    if unset:
        print(f"{RED}Missing local settings — .env.example has a working value for each:{OFF}")
        for key in unset:
            print(f"    {key}={example[key]}")
        print()

    if external:
        print(f"{YELLOW}Not set — these are yours to obtain, nothing can default them:{OFF}")
        for key in external:
            print(f"    {key:<24} {DIM}without it, {EXTERNAL[key]}{OFF}")
        speech = {"DEEPGRAM_API_KEY", "CARTESIA_API_KEY"}
        if speech & set(external):
            print(
                f"    {DIM}The interviewer still runs and still says everything — as text,"
                f" in the transcript panel.{OFF}"
            )

    # Zero either way: a stack that is only partly configured still starts, and this is a
    # report rather than a gate.
    return 0


if __name__ == "__main__":
    sys.exit(main())
