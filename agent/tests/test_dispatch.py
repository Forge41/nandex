import json

import pytest
from interviewer import dispatch
from interviewer.briefing import load_prompt
from interviewer.portfolio import format_passages


def test_an_interview_token_dispatches_the_interviewer():
    role = dispatch.parse(json.dumps({"session_id": "s1", "stage": "plan"}))
    assert role == dispatch.Dispatch(mode=dispatch.INTERVIEW, session_id="s1")


def test_a_portfolio_token_dispatches_the_guide_with_its_time_limit():
    role = dispatch.parse(json.dumps({"mode": "portfolio", "max_minutes": 3}))
    assert role == dispatch.Dispatch(mode=dispatch.PORTFOLIO, max_minutes=3)


def test_portfolio_mode_wins_even_if_a_session_id_is_present():
    role = dispatch.parse(json.dumps({"mode": "portfolio", "session_id": "s1"}))
    assert role.mode == dispatch.PORTFOLIO


@pytest.mark.parametrize("minutes", [None, 0, -1, "5"])
def test_a_missing_or_bad_time_limit_falls_back_to_the_default(minutes):
    role = dispatch.parse(json.dumps({"mode": "portfolio", "max_minutes": minutes}))
    assert role.max_minutes == dispatch.DEFAULT_PORTFOLIO_MINUTES


@pytest.mark.parametrize("raw", ["", "not json", "[]", json.dumps({"stage": "plan"})])
def test_metadata_naming_no_role_is_refused(raw):
    assert dispatch.parse(raw) is None


def test_passages_are_given_to_the_model_without_ids():
    text = format_passages([{"id": "resume-sde2", "title": "SDE-II", "content": "Built RAG."}])
    assert text == "SDE-II: Built RAG."
    assert "resume-sde2" not in text


def test_no_passages_says_so():
    assert format_passages([]) == "Nothing in the portfolio matches that."


def test_the_guide_prompt_requires_the_lookup_tool():
    assert "search_portfolio" in load_prompt("portfolio_guide.md")
