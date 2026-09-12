"""Generates the task inside one round, from the plan the resume produced.

One generator per stage rather than one prompt for all of them: a behavioral question, a
coding task with starter files and a SQL schema share no output shape, and a single
prompt asked for all three returns a worse version of each.

Stages absent from GENERATABLE_STAGE_IDS have no generator yet. They keep an empty
payload and the UI renders its missing-content state, which is honest where inventing a
task would not be.
"""

import json
import logging

from ai.client import complete
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.interview.config import settings
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts

logger = logging.getLogger(__name__)

GENERATABLE_STAGE_IDS = frozenset({"behavioral"})


class RoundContentUnusable(Exception):
    """The model's answer for a round could not be understood."""


async def generate(session: InterviewSession, stage_id: str) -> dict | None:
    if stage_id not in GENERATABLE_STAGE_IDS:
        return None
    return await _generate_behavioral(session)


async def _generate_behavioral(session: InterviewSession) -> dict | None:
    brief = await sync_to_async(_brief_sync, thread_sensitive=True)(session.id, "behavioral")
    if brief is None:
        return None

    raw = await complete(
        system_prompt=load_prompt("interview_round_behavioral_system.md"),
        messages=[{"role": "user", "content": json.dumps(brief)}],
        model=settings.plan_model,
    )
    written = _decode(raw)

    question = str(written.get("question") or "").strip()
    if not question:
        raise RoundContentUnusable("The round question was empty")

    derived = [
        str(label).strip()
        for label in written.get("derivedFrom") or []
        if str(label).strip()
    ][:3]

    content = {
        "questionNumber": 1,
        "question": question,
        # Never empty: the stage renders these as the question's provenance, and a
        # question with no stated source is the thing this whole plan exists to avoid.
        "derivedFrom": derived or ["your resume"],
    }
    # Only when it points at a citation the resume really produced.
    citation = written.get("citation")
    if isinstance(citation, int) and citation in {c["id"] for c in brief["citations"]}:
        content["citation"] = citation
    return content


def _brief_sync(session_id: str, stage_id: str) -> dict | None:
    """What the model is told: this round, and the probes already tied to it.

    None when no plan exists yet -- generating a question from nothing would produce a
    generic interview, which is the opposite of the point.
    """
    facts = ResumeFacts.objects.filter(session_id=session_id).first()
    round_ = InterviewRound.objects.filter(session_id=session_id, stage_id=stage_id).first()
    if facts is None or round_ is None:
        return None

    return {
        "role": round_.session.role_title,
        "round": {"id": stage_id, "label": round_.label, "summary": round_.summary},
        "probes": [p for p in facts.probes if p.get("round") == stage_id],
        "citations": [c for c in facts.citations if isinstance(c.get("id"), int)],
    }


def _decode(raw: str) -> dict:
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1].removeprefix("json").strip()
    try:
        written = json.loads(text)
    except json.JSONDecodeError as e:
        raise RoundContentUnusable("The round content was not valid JSON") from e
    if not isinstance(written, dict):
        raise RoundContentUnusable("The round content was not an object")
    return written
