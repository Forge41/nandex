"""What a room asked this worker to be, read from the dispatch metadata.

One worker serves two surfaces. core's interview tokens dispatch it with a session id;
the portfolio's voice tokens dispatch it with mode "portfolio". Nothing else decides the
role -- not the room name, whose format belongs to whoever minted the token.
"""

import json
import logging
from dataclasses import dataclass

logger = logging.getLogger("interviewer.dispatch")

INTERVIEW = "interview"
PORTFOLIO = "portfolio"

DEFAULT_PORTFOLIO_MINUTES = 5


@dataclass(frozen=True)
class Dispatch:
    mode: str
    session_id: str | None = None
    max_minutes: int = DEFAULT_PORTFOLIO_MINUTES


def parse(raw: str) -> Dispatch | None:
    """None when the metadata names no role this worker can play."""
    if not raw:
        return None
    try:
        meta = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Dispatch metadata was not JSON: %r", raw[:200])
        return None
    if not isinstance(meta, dict):
        return None

    if meta.get("mode") == PORTFOLIO:
        minutes = meta.get("max_minutes")
        return Dispatch(
            mode=PORTFOLIO,
            max_minutes=minutes
            if isinstance(minutes, int) and minutes > 0
            else DEFAULT_PORTFOLIO_MINUTES,
        )
    # Interview tokens predate `mode`, so a session id alone still means an interview.
    if meta.get("session_id"):
        return Dispatch(mode=INTERVIEW, session_id=meta["session_id"])
    return None
