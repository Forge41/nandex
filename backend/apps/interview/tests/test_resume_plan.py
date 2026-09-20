"""sanitize_plan is the boundary between a model's output and what the UI renders.

A round the interview does not have silently never appears, and an empty section renders
as a heading with nothing under it. Both are better dropped here than shown.
"""

import pytest

from apps.ingest.pipeline.parsed_document import ParsedDocument, Segment
from apps.interview.resume import (
    ResumeUnreadable,
    _decode_plan,
    page_count_of,
    resume_text_of,
    sanitize_plan,
)

PLAN = {
    "candidate": {"name": "Priya R", "title": "Senior Backend Engineer", "yearsExperience": 6},
    "sections": [
        {
            "id": "experience",
            "label": "Experience",
            "paragraphs": ["Owned the ledger handling 1.4M transactions a day."],
        }
    ],
    "probes": [
        {"id": "p1", "title": "Kafka at scale", "note": "Worth grounding", "round": "coding"}
    ],
    "rounds": [{"id": "sql", "summary": "Tests the SQL claim."}],
    "entityCount": 18,
}


def test_a_well_formed_plan_survives_intact():
    clean = sanitize_plan(PLAN)

    assert clean["sections"][0]["paragraphs"] == [
        "Owned the ledger handling 1.4M transactions a day."
    ]
    assert clean["probes"][0]["round"] == "coding"
    assert clean["rounds"]["sql"] == {"summary": "Tests the SQL claim."}
    assert clean["entity_count"] == 18


@pytest.mark.parametrize("stage", ["preflight", "resume", "wrap", "invented", ""])
def test_a_plan_cannot_speak_about_a_round_it_does_not_own(stage):
    """preflight, resume and wrap are fixed scaffolding; anything else does not exist."""
    plan = {
        **PLAN,
        "probes": [{"id": "p1", "title": "t", "note": "n", "round": stage}],
        "rounds": [{"id": stage, "summary": "s"}],
    }

    clean = sanitize_plan(plan)

    assert clean["probes"] == []
    assert clean["rounds"] == {}


def test_a_paragraph_that_is_not_prose_is_dropped_rather_than_rendered():
    """The model is asked for strings. Anything else on screen is not the resume."""
    plan = {
        **PLAN,
        "sections": [{"id": "x", "label": "X", "paragraphs": [None, "real", "   ", 7]}],
    }

    assert sanitize_plan(plan)["sections"][0]["paragraphs"] == ["real"]


def test_an_empty_section_is_dropped_rather_than_rendered_as_a_heading():
    plan = {**PLAN, "sections": [{"id": "x", "label": "Empty", "paragraphs": []}]}
    assert sanitize_plan(plan)["sections"] == []


def test_a_plan_missing_every_optional_key_does_not_raise():
    clean = sanitize_plan({})

    assert clean["sections"] == []
    assert clean["probes"] == []
    assert clean["rounds"] == {}
    assert clean["entity_count"] == 0


def test_a_non_integer_entity_count_falls_back_to_zero():
    assert sanitize_plan({**PLAN, "entityCount": "eighteen"})["entity_count"] == 0


def test_a_fenced_response_is_decoded():
    """Asking for bare JSON does not guarantee it."""
    assert _decode_plan('```json\n{"entityCount": 3}\n```') == {"entityCount": 3}
    assert _decode_plan('```\n{"entityCount": 3}\n```') == {"entityCount": 3}
    assert _decode_plan('  {"entityCount": 3}  ') == {"entityCount": 3}


@pytest.mark.parametrize("raw", ["not json", "", "[1, 2, 3]", '"a string"'])
def test_an_undecodable_plan_is_an_explicit_failure(raw):
    with pytest.raises(ResumeUnreadable):
        _decode_plan(raw)


def test_page_count_comes_from_the_parser_and_is_none_when_unknown():
    """None rather than a guess: the count sits beside a preview of the document, so being
    wrong is immediately visible."""
    paged = ParsedDocument(
        segments=[
            Segment(type="prose", text="a", page_idx=0),
            Segment(type="prose", text="b", page_idx=1),
        ],
        source_content_type="application/pdf",
    )
    unpaged = ParsedDocument(
        segments=[Segment(type="prose", text="a")], source_content_type="text/plain"
    )

    assert page_count_of(paged) == 2
    assert page_count_of(unpaged) is None


def test_resume_text_skips_blank_segments():
    parsed = ParsedDocument(
        segments=[
            Segment(type="prose", text="Experience"),
            Segment(type="prose", text="   "),
            Segment(type="prose", text="Northwind"),
        ],
        source_content_type="text/plain",
    )

    assert resume_text_of(parsed) == "Experience\n\nNorthwind"
