"""sanitize_plan is the boundary between a model's output and what the UI renders.

The plan points at the resume with line ranges rather than reproducing it, so this is
also where the pointing is checked: a range outside the document points at nothing, a
round the interview does not have silently never appears, and an empty section renders
as a heading with nothing under it. All three are better dropped here than shown.
"""

import pytest

from apps.ingest.pipeline.parsed_document import ParsedDocument, Segment
from apps.interview.resume import (
    ResumeUnreadable,
    _decode_plan,
    number_lines,
    page_count_of,
    resume_text_of,
    sanitize_plan,
)

RESUME_TEXT = "\n".join(
    [
        "Priya R",
        "Senior Backend Engineer",
        "",
        "Experience",
        "Owned the ledger handling 1.4M transactions a day.",
        "Led the migration to a Kafka-backed pipeline.",
        "",
        "Skills",
        "Go, Python, Postgres",
    ]
)

PLAN = {
    "candidate": {"name": "Priya R", "title": "Senior Backend Engineer", "yearsExperience": 6},
    "sections": [
        {
            "id": "experience",
            "label": "Experience",
            "lines": [[4, 6]],
        }
    ],
    "probes": [
        {"id": "p1", "title": "Kafka at scale", "note": "Worth grounding", "round": "coding"}
    ],
    "rounds": [{"id": "sql", "summary": "Tests the SQL claim."}],
    "entityCount": 18,
}


def test_a_range_is_sliced_out_of_the_resume_rather_than_rewritten():
    """The model never writes the prose, so it cannot alter it. This is the contract."""
    clean = sanitize_plan(PLAN, RESUME_TEXT)

    assert clean["sections"][0]["paragraphs"] == [
        "Experience\nOwned the ledger handling 1.4M transactions a day.\n"
        "Led the migration to a Kafka-backed pipeline."
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

    clean = sanitize_plan(plan, RESUME_TEXT)

    assert clean["probes"] == []
    assert clean["rounds"] == {}


def test_a_range_outside_the_document_is_dropped_rather_than_clamped():
    """Asked for ranges against a PDF it could not count lines in, the model invented a
    tidy contiguous partition of a document that did not exist. Clamping such a range
    would put one part of a resume under another part's heading; dropping it leaves a
    gap, which is visible."""
    plan = {
        **PLAN,
        "sections": [
            {"id": "x", "label": "X", "lines": [[4, 6], [200, 400], [6, 4], ["a", "b"], [1]]}
        ],
    }

    assert len(sanitize_plan(plan, RESUME_TEXT)["sections"][0]["paragraphs"]) == 1


def test_an_empty_section_is_dropped_rather_than_rendered_as_a_heading():
    plan = {**PLAN, "sections": [{"id": "x", "label": "Empty", "lines": []}]}
    assert sanitize_plan(plan, RESUME_TEXT)["sections"] == []


def test_a_range_over_blank_lines_yields_nothing_rather_than_whitespace():
    plan = {**PLAN, "sections": [{"id": "x", "label": "Gap", "lines": [[3, 3]]}]}
    assert sanitize_plan(plan, RESUME_TEXT)["sections"] == []


def test_more_probes_than_an_interview_can_run_are_cut():
    """One real resume produced twenty-one. The rounds are not long enough for six."""
    plan = {
        **PLAN,
        "probes": [
            {"id": f"p{i}", "title": f"t{i}", "note": "n", "round": "coding"} for i in range(21)
        ],
    }

    assert len(sanitize_plan(plan, RESUME_TEXT)["probes"]) == 6


def test_the_resume_reaches_the_model_with_its_lines_numbered():
    """The ranges are answers to these numbers, so they have to be in the question."""
    numbered = number_lines("alpha\nbeta")

    assert numbered == "1\talpha\n2\tbeta"


def test_a_plan_missing_every_optional_key_does_not_raise():
    clean = sanitize_plan({}, RESUME_TEXT)

    assert clean["sections"] == []
    assert clean["probes"] == []
    assert clean["rounds"] == {}
    assert clean["entity_count"] == 0


def test_a_non_integer_entity_count_falls_back_to_zero():
    assert sanitize_plan({**PLAN, "entityCount": "eighteen"}, RESUME_TEXT)["entity_count"] == 0


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
