"""The agent's only way to reach anything.

Core is the orchestrator: the agent has no database connection, no tps client and no vas
client. Everything it knows about a candidate it was told through these two calls.
"""

import logging
from dataclasses import dataclass, field

import httpx

from interviewer.config import settings

logger = logging.getLogger("interviewer.core")


class CoreUnavailable(Exception):
    """Core could not be reached, or refused."""


@dataclass
class Brief:
    """One session, as the interviewer needs to understand it."""

    session_id: str
    candidate_name: str
    role_title: str
    active_stage: str
    plan_ready: bool
    total_duration_min: int
    rounds: list[dict] = field(default_factory=list)
    probes: list[dict] = field(default_factory=list)
    citations: list[dict] = field(default_factory=list)
    candidate_title: str = ""
    # Present only while the candidate is in the coding round. Counts and failing case
    # names, never their source.
    coding: dict | None = None

    @classmethod
    def from_payload(cls, payload: dict) -> "Brief":
        resume = payload.get("resume") or {}
        candidate = resume.get("candidate") or {}
        return cls(
            session_id=payload["sessionId"],
            candidate_name=payload.get("candidateName") or candidate.get("name") or "",
            role_title=payload.get("roleTitle") or "",
            active_stage=payload.get("activeStage") or "",
            plan_ready=bool(payload.get("planReady")),
            total_duration_min=payload.get("totalDurationMin") or 0,
            rounds=payload.get("rounds") or [],
            probes=resume.get("probes") or [],
            citations=resume.get("citations") or [],
            candidate_title=candidate.get("title") or "",
            coding=payload.get("coding"),
        )

    def quote_for(self, citation_id: int | None) -> str:
        """The resume line a probe or round came from, verbatim.

        The interviewer quotes the candidate's own words back to them, so this must be
        the stored quote and never a paraphrase of it.
        """
        if citation_id is None:
            return ""
        for citation in self.citations:
            if citation.get("id") == citation_id:
                return str(citation.get("quote") or "")
        return ""


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        base_url=settings.core_base_url,
        timeout=settings.core_timeout_seconds,
        headers={"Authorization": f"Bearer {settings.agent_bearer_token}"},
    )


async def fetch_brief(session_id: str) -> Brief:
    async with _client() as client:
        try:
            response = await client.get(f"/interview/agent/sessions/{session_id}/brief")
        except httpx.HTTPError as e:
            raise CoreUnavailable(f"couldn't reach core: {e}") from e

    if response.status_code == 401:
        raise CoreUnavailable(
            "core rejected the agent token -- INTERVIEW_AGENT_BEARER_TOKEN must match on both sides"
        )
    if response.status_code != 200:
        raise CoreUnavailable(f"core answered {response.status_code} for session {session_id}")

    return Brief.from_payload(response.json())


async def save_transcript(session_id: str, turns: list[dict]) -> int:
    """Appends the conversation. Never raises: a transcript that failed to save is worth
    a loud log, but the interview it belongs to is already over."""
    if not turns:
        return 0
    async with _client() as client:
        try:
            response = await client.post(
                f"/interview/agent/sessions/{session_id}/transcript", json={"turns": turns}
            )
            response.raise_for_status()
            return int(response.json().get("written", 0))
        except Exception:
            logger.exception("Couldn't save the transcript for %s", session_id)
            return 0
