"""Turns an uploaded resume into the facts the interviewer reads, and the round plan.

The resume itself lives in importer's RawDocument, which is immutable -- this module only
ever reads it. Text extraction reuses apps.ingest's parsers rather than adding a second
PDF reader to the project.
"""

import json
import logging

from ai.client import complete
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.importer.models import RawDocument
from apps.ingest.pipeline.parsed_document import ParsedDocument
from apps.ingest.pipeline.parsers import get_parser
from apps.interview.config import settings
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts

logger = logging.getLogger(__name__)

# Rounds a plan may speak about. preflight, resume and wrap are fixed scaffolding, so a
# plan that tried to change them would be overriding the interview's own structure.
PLANNABLE_STAGE_IDS = frozenset({"behavioral", "coding", "sql", "debug", "design", "quiz", "qa"})


class ResumeUnreadable(Exception):
    """The document could not be parsed, or the plan could not be understood."""


def _read_document_sync(document_id: str, project_id: str) -> RawDocument | None:
    return RawDocument.objects.filter(id=document_id, project_id=project_id).first()


def _parse_sync(document: RawDocument) -> ParsedDocument:
    return get_parser(document.content_type).parse(bytes(document.payload), document.content_type)


def page_count_of(parsed: ParsedDocument) -> int | None:
    """The real page count, or None when the parser does not report pages.

    None rather than a guess: the count sits next to a preview of the document, so being
    wrong is immediately visible and reads as the whole reading being untrustworthy.
    """
    pages = {s.page_idx for s in parsed.segments if s.page_idx is not None}
    return max(pages) + 1 if pages else None


def resume_text_of(parsed: ParsedDocument) -> str:
    return "\n\n".join(s.text for s in parsed.segments if s.text.strip())


async def generate_plan(resume_text: str) -> dict:
    raw = await complete(
        system_prompt=load_prompt("interview_plan_system.md"),
        messages=[{"role": "user", "content": resume_text}],
        model=settings.plan_model,
    )
    return _decode_plan(raw)


def _decode_plan(raw: str) -> dict:
    """Tolerates a fenced response, because asking for bare JSON does not guarantee it."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        text = text.removeprefix("json").strip()
    try:
        plan = json.loads(text)
    except ValueError as e:
        raise ResumeUnreadable("The interview plan was not valid JSON") from e
    if not isinstance(plan, dict):
        raise ResumeUnreadable("The interview plan was not an object")
    return plan


def _citation_ids(plan: dict) -> set[int]:
    return {
        c["id"]
        for c in plan.get("citations") or []
        if isinstance(c, dict) and isinstance(c.get("id"), int)
    }


def sanitize_plan(plan: dict) -> dict:
    """Drops anything the plan asserts that we cannot honour.

    A citation id that does not exist would render as a chip pointing at nothing, and a
    round the interview does not have would silently never appear -- both are better
    dropped here than rendered as a broken reference.
    """
    valid_ids = _citation_ids(plan)

    def keep_citation(value) -> bool:
        return isinstance(value, int) and value in valid_ids

    sections = []
    for section in plan.get("sections") or []:
        if not isinstance(section, dict):
            continue
        paragraphs = []
        for paragraph in section.get("paragraphs") or []:
            fragments = []
            for fragment in paragraph or []:
                if not isinstance(fragment, dict) or not isinstance(fragment.get("text"), str):
                    continue
                kept = {"text": fragment["text"]}
                if keep_citation(fragment.get("citation")):
                    kept["citation"] = fragment["citation"]
                fragments.append(kept)
            if fragments:
                paragraphs.append(fragments)
        if paragraphs:
            sections.append(
                {
                    "id": str(section.get("id") or f"section-{len(sections) + 1}"),
                    "label": str(section.get("label") or ""),
                    "paragraphs": paragraphs,
                }
            )

    probes = []
    for probe in plan.get("probes") or []:
        if not isinstance(probe, dict):
            continue
        stage = probe.get("round")
        if stage not in PLANNABLE_STAGE_IDS:
            continue
        kept = {
            "id": str(probe.get("id") or f"p{len(probes) + 1}"),
            "title": str(probe.get("title") or ""),
            "note": str(probe.get("note") or ""),
            "round": stage,
        }
        if keep_citation(probe.get("citation")):
            kept["citation"] = probe["citation"]
        probes.append(kept)

    citations = [
        {"id": c["id"], "quote": str(c.get("quote") or ""), "source": str(c.get("source") or "")}
        for c in plan.get("citations") or []
        if isinstance(c, dict) and isinstance(c.get("id"), int)
    ]

    rounds = {}
    for round_ in plan.get("rounds") or []:
        if not isinstance(round_, dict):
            continue
        stage = round_.get("id")
        if stage not in PLANNABLE_STAGE_IDS:
            continue
        rounds[stage] = {
            "summary": str(round_.get("summary") or ""),
            "citation": round_["citation"] if keep_citation(round_.get("citation")) else None,
        }

    candidate = plan.get("candidate") if isinstance(plan.get("candidate"), dict) else {}
    return {
        "candidate": candidate,
        "citations": citations,
        "sections": sections,
        "probes": probes,
        "rounds": rounds,
        "entity_count": plan.get("entityCount") if isinstance(plan.get("entityCount"), int) else 0,
    }


def _persist_sync(
    session: InterviewSession,
    document: RawDocument,
    page_count: int | None,
    plan: dict,
) -> ResumeFacts:
    candidate = plan["candidate"]
    years = candidate.get("yearsExperience")
    facts, _ = ResumeFacts.objects.update_or_create(
        session=session,
        defaults={
            "file_name": document.display_name or "resume",
            "size_bytes": len(document.payload),
            "page_count": page_count,
            "entity_count": plan["entity_count"],
            "candidate_name": str(candidate.get("name") or ""),
            "candidate_title": str(candidate.get("title") or ""),
            "candidate_location": str(candidate.get("location") or ""),
            "candidate_email": str(candidate.get("email") or ""),
            "candidate_years_experience": years if isinstance(years, int) else None,
            "sections": plan["sections"],
            "probes": plan["probes"],
            "citations": plan["citations"],
        },
    )

    for stage, values in plan["rounds"].items():
        InterviewRound.objects.filter(session=session, stage_id=stage).update(
            summary=values["summary"], citation=values["citation"]
        )

    updates = ["resume_document_id", "updated_at"]
    session.resume_document_id = document.id
    # The candidate's own name from their resume, not something the caller asserted: the
    # top bar shows it, and it should match the document on screen beside it.
    if facts.candidate_name:
        session.candidate_name = facts.candidate_name
        updates.append("candidate_name")
    session.save(update_fields=updates)
    return facts


async def attach_resume(session: InterviewSession, document_id: str) -> ResumeFacts:
    document = await sync_to_async(_read_document_sync, thread_sensitive=True)(
        document_id, session.project_id
    )
    if document is None:
        raise ResumeUnreadable("That document could not be found")

    try:
        parsed = await sync_to_async(_parse_sync, thread_sensitive=True)(document)
    except Exception as e:
        logger.warning("Couldn't parse resume %s", document_id, exc_info=True)
        raise ResumeUnreadable("That file could not be read") from e

    text = resume_text_of(parsed)
    if not text.strip():
        raise ResumeUnreadable("That file contained no readable text")

    plan = sanitize_plan(await generate_plan(text))
    return await sync_to_async(_persist_sync, thread_sensitive=True)(
        session, document, page_count_of(parsed), plan
    )


__all__ = [
    "ResumeUnreadable",
    "attach_resume",
    "generate_plan",
    "page_count_of",
    "resume_text_of",
    "sanitize_plan",
]
