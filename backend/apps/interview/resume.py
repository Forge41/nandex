"""Turns an uploaded resume into the facts the interviewer reads, and the round plan.

The resume itself lives in importer's RawDocument, which is immutable -- this module only
ever reads it. Text extraction reuses apps.ingest's parsers rather than adding a second
PDF reader to the project.
"""

import json
import logging
from dataclasses import dataclass

from ai.client import complete
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.importer.models import RawDocument
from apps.ingest.pipeline.parsed_document import ParsedDocument
from apps.ingest.pipeline.parsers import get_parser
from apps.interview.config import settings
from apps.interview.models import InterviewRound, InterviewSession, ResumeFacts
from apps.interview.rounds import STAGE_IDS

logger = logging.getLogger(__name__)

# Rounds a plan may speak about. preflight, resume and wrap are fixed scaffolding, so a
# plan that tried to change them would be overriding the interview's own structure.
PLANNABLE_STAGE_IDS = frozenset({"behavioral", "coding", "sql", "debug", "design", "quiz", "qa"})

RESUME_ROUND_INDEX = STAGE_IDS.index("resume")


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


def number_lines(resume_text: str) -> str:
    """The resume as the model sees it, one line per number.

    Numbering is what makes the plan cheap: the model answers with ranges into this
    rather than re-typing the document, which is the difference between ~3,200 output
    tokens and ~900. Ranges are 1-based, because the model is looking at these numbers.
    """
    return "\n".join(f"{i}\t{line}" for i, line in enumerate(resume_text.split("\n"), start=1))


async def generate_plan(resume_text: str) -> dict:
    raw = await complete(
        system_prompt=load_prompt("interview_plan_system.md"),
        messages=[{"role": "user", "content": number_lines(resume_text)}],
        model=settings.plan_model,
        fast=True,
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


MAX_PROBES = 6


def _paragraphs_from_lines(section: dict, lines: list[str]) -> list[str]:
    """The resume's own text, cut out at the ranges the plan pointed to.

    The model never writes the prose, so it cannot alter it -- that is the point of
    asking for ranges. What it can still do is point somewhere the document does not go,
    and a range that does not fit is dropped rather than clamped: a half-range would put
    part of one section under another's heading, which is the failure this is meant to
    make impossible rather than quieter.
    """
    paragraphs = []
    for span in section.get("lines") or []:
        if not (isinstance(span, list | tuple) and len(span) == 2):
            continue
        start, end = span
        if not (isinstance(start, int) and isinstance(end, int)):
            continue
        if not (1 <= start <= end <= len(lines)):
            continue
        text = "\n".join(lines[start - 1 : end]).strip()
        if text:
            paragraphs.append(text)
    return paragraphs


def sanitize_plan(plan: dict, resume_text: str) -> dict:
    """Drops anything the plan asserts that we cannot honour.

    A round the interview does not have would silently never appear, and a line range
    outside the document points at nothing. Both are better dropped here than shown.
    """
    lines = resume_text.split("\n")

    sections = []
    for section in plan.get("sections") or []:
        if not isinstance(section, dict):
            continue
        paragraphs = _paragraphs_from_lines(section, lines)
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
        probes.append(
            {
                "id": str(probe.get("id") or f"p{len(probes) + 1}"),
                "title": str(probe.get("title") or ""),
                "note": str(probe.get("note") or ""),
                "round": stage,
            }
        )
        # The prompt asks for at most six. Enforced here as well because a list of
        # twenty-one -- which is what one real resume produced -- is a screen nobody
        # reads and an interview nobody could run.
        if len(probes) == MAX_PROBES:
            break

    rounds = {}
    for round_ in plan.get("rounds") or []:
        if not isinstance(round_, dict):
            continue
        stage = round_.get("id")
        if stage not in PLANNABLE_STAGE_IDS:
            continue
        rounds[stage] = {"summary": str(round_.get("summary") or "")}

    candidate = plan.get("candidate") if isinstance(plan.get("candidate"), dict) else {}
    return {
        "candidate": candidate,
        "sections": sections,
        "probes": probes,
        "rounds": rounds,
        "entity_count": plan.get("entityCount") if isinstance(plan.get("entityCount"), int) else 0,
    }


def _persist_sync(
    session: InterviewSession,
    parsed: "ParsedResume",
    plan: dict,
) -> ResumeFacts:
    candidate = plan["candidate"]
    years = candidate.get("yearsExperience")
    facts, _ = ResumeFacts.objects.update_or_create(
        session=session,
        defaults={
            "file_name": parsed.file_name,
            "size_bytes": parsed.size_bytes,
            "page_count": parsed.page_count,
            "entity_count": plan["entity_count"],
            "candidate_name": str(candidate.get("name") or ""),
            "candidate_title": str(candidate.get("title") or ""),
            "candidate_location": str(candidate.get("location") or ""),
            "candidate_email": str(candidate.get("email") or ""),
            "candidate_years_experience": years if isinstance(years, int) else None,
            "sections": plan["sections"],
            "probes": plan["probes"],
        },
    )

    for stage, values in plan["rounds"].items():
        InterviewRound.objects.filter(session=session, stage_id=stage).update(
            summary=values["summary"]
        )

    updates = ["resume_document_id", "updated_at"]
    session.resume_document_id = parsed.document_id
    # The plan existing is what finishes the pre-flight, so the session moves to the
    # round that shows it. Written here rather than left to the browser so a refresh
    # lands on the plan instead of back at the dropzone. Only ever forward: a resume
    # replaced later in an interview must not drag the candidate back to round two.
    if session.progress_index < RESUME_ROUND_INDEX:
        session.active_stage = "resume"
        session.progress_index = RESUME_ROUND_INDEX
        updates += ["active_stage", "progress_index"]
    # The candidate's own name from their resume, not something the caller asserted: the
    # top bar shows it, and it should match the document on screen beside it.
    if facts.candidate_name:
        session.candidate_name = facts.candidate_name
        updates.append("candidate_name")
    session.save(update_fields=updates)
    return facts


@dataclass(frozen=True)
class ParsedResume:
    """What reading the document established, before any model has seen it.

    Carried between two workflow activities, so every field has to survive a JSON round
    trip -- which is why this holds the document's own facts rather than the RawDocument.
    """

    document_id: str
    file_name: str
    size_bytes: int
    page_count: int | None
    text: str

    def as_dict(self) -> dict:
        return {
            "document_id": self.document_id,
            "file_name": self.file_name,
            "size_bytes": self.size_bytes,
            "page_count": self.page_count,
            "text": self.text,
        }

    @classmethod
    def from_dict(cls, payload: dict) -> "ParsedResume":
        return cls(
            document_id=payload["document_id"],
            file_name=payload["file_name"],
            size_bytes=payload["size_bytes"],
            page_count=payload["page_count"],
            text=payload["text"],
        )


async def read_and_parse(session: InterviewSession, document_id: str) -> ParsedResume:
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

    return ParsedResume(
        document_id=document.id,
        file_name=document.display_name or "resume",
        size_bytes=len(document.payload),
        page_count=page_count_of(parsed),
        text=text,
    )


async def build_plan(resume_text: str) -> dict:
    return sanitize_plan(await generate_plan(resume_text), resume_text)


async def persist_plan(session: InterviewSession, parsed: ParsedResume, plan: dict) -> ResumeFacts:
    return await sync_to_async(_persist_sync, thread_sensitive=True)(session, parsed, plan)


async def attach_resume(session: InterviewSession, document_id: str) -> ResumeFacts:
    parsed = await read_and_parse(session, document_id)
    return await persist_plan(session, parsed, await build_plan(parsed.text))


__all__ = [
    "ParsedResume",
    "ResumeUnreadable",
    "attach_resume",
    "build_plan",
    "generate_plan",
    "page_count_of",
    "persist_plan",
    "read_and_parse",
    "resume_text_of",
    "sanitize_plan",
]
