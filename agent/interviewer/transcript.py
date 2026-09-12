"""Collects what was said, in the shape core stores.

Buffered rather than posted per utterance -- a round trip to core inside every turn puts
its latency in the middle of a conversation. Flushed on a timer as well as at shutdown,
because an interview runs over an hour and a crash that loses all of it is worse than a
few seconds of duplicated effort.

Only unflushed turns are ever sent, so a flush that fails leaves them queued for the next
one rather than dropping them.
"""

import time
from dataclasses import dataclass, field


@dataclass
class TranscriptRecorder:
    session_id: str
    started_at: float = field(default_factory=time.monotonic)
    _turns: list[dict] = field(default_factory=list)
    _flushed: int = 0

    def add(self, item) -> None:
        """Records one conversation item, if it is something a person said.

        System instructions and tool calls are not turns -- the transcript is shown to
        the candidate and reviewed by a human, and it should read as the conversation
        they actually had.
        """
        role = getattr(item, "role", None)
        if role not in ("user", "assistant"):
            return

        text = _text_of(item)
        if not text:
            return

        self._turns.append(
            {
                "speaker": "candidate" if role == "user" else "interviewer",
                "text": text,
                # Seconds since this agent joined, which is what the timer on screen counts
                # from -- a wall-clock stamp would disagree with what the candidate saw.
                "atSeconds": int(time.monotonic() - self.started_at),
            }
        )

    def turns(self) -> list[dict]:
        return list(self._turns)

    def pending(self) -> list[dict]:
        """Turns not yet accepted by core."""
        return self._turns[self._flushed :]

    def mark_flushed(self, count: int) -> None:
        """Only what core confirmed it wrote. A partial write leaves the rest queued."""
        self._flushed += count


def _text_of(item) -> str:
    content = getattr(item, "text_content", None)
    if isinstance(content, str):
        return content.strip()
    # Older items carry a list of parts; only the strings among them are speech.
    parts = getattr(item, "content", None) or []
    return " ".join(part for part in parts if isinstance(part, str)).strip()
