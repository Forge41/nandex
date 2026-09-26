import json
from datetime import timedelta

import pytest
from django.core import mail
from django.core.management import call_command
from django.test import AsyncClient
from django.utils import timezone

from apps.core.models import User
from apps.importer.models import RawDocument
from apps.portfolio.config import settings as portfolio_settings
from apps.portfolio.corpus import TITLE_SEPARATOR
from apps.portfolio.models import ContactMessage, PortfolioQuery
from apps.retrieval.results import SearchResult


def _result(raw_document_id: str, content: str = "passage") -> SearchResult:
    return SearchResult(
        chunk_id=f"chunk-{raw_document_id}",
        raw_document_id=raw_document_id,
        content=content,
        page_idx=None,
        start_idx=None,
        end_idx=None,
        metadata={},
        score=1.0,
    )


def _store(source_id: str) -> RawDocument:
    return RawDocument.objects.create(
        connection_id="upload",
        project_id="portfolio",
        provider_document_id=f"portfolio:{source_id}",
        provider_version="v1",
        payload=b"x",
    )


async def _events(response) -> list[dict]:
    body = b"".join([chunk async for chunk in response.streaming_content]).decode()
    return [json.loads(line.removeprefix("data: ")) for line in body.split("\n\n") if line]


async def _post(path: str, body: dict, headers: dict | None = None):
    return await AsyncClient().post(
        path, data=body, content_type="application/json", headers=headers
    )


@pytest.fixture
def indexed(corpus_dir, db):
    corpus_dir({"alpha": "Built a RAG pipeline.", "beta": "Voice agents."})
    return {"alpha": _store("alpha"), "beta": _store("beta")}


@pytest.mark.django_db(transaction=True)
async def test_ask_streams_retrieved_sources_then_deltas_then_done(
    indexed, fake_search, fake_stream_answer
):
    alpha = indexed["alpha"]
    searches = fake_search(lambda ids: [_result(alpha.id, "Built a RAG pipeline.")])
    requests = fake_stream_answer(["I built", " RAG[alpha]."])

    response = await _post("/portfolio/ask", {"question": "what did you build?"})

    assert response.status_code == 200
    assert response["Content-Type"] == "text/event-stream"
    events = await _events(response)
    assert events[0] == {"retrieved": [{"id": "alpha", "doc": "resume.pdf", "title": "Alpha"}]}
    assert "".join(e["delta"] for e in events[1:-1]) == "I built RAG[alpha]."
    assert events[-1]["done"] is True
    assert events[-1]["output_tokens"] == 42

    assert set(searches[0]["raw_document_ids"]) == {indexed["alpha"].id, indexed["beta"].id}
    assert requests[0]["model"] == portfolio_settings.model
    assert requests[0]["max_tokens"] == portfolio_settings.max_output_tokens
    assert f"[alpha] (resume.pdf {TITLE_SEPARATOR} Alpha)" in requests[0]["messages"][0]["content"]

    query = await PortfolioQuery.objects.aget()
    assert (query.kind, query.outcome, query.retrieved) == ("ask", "answered", ["alpha"])
    assert query.answer == "I built RAG[alpha]."


@pytest.mark.django_db(transaction=True)
async def test_fit_uses_the_fit_prompt(indexed, fake_search, fake_stream_answer):
    alpha = indexed["alpha"]
    fake_search(lambda ids: [_result(alpha.id)])
    requests = fake_stream_answer(["Strong fit."])

    response = await _post("/portfolio/fit", {"jd": "Senior GenAI engineer, RAG, Temporal."})

    events = await _events(response)
    assert events[-1]["done"] is True
    assert "job description" in requests[0]["system_prompt"]
    assert (await PortfolioQuery.objects.aget()).kind == "fit"


@pytest.mark.django_db(transaction=True)
async def test_a_mid_stream_failure_ends_with_a_fallback_event_and_is_logged(
    indexed, fake_search, fake_stream_answer
):
    alpha = indexed["alpha"]
    fake_search(lambda ids: [_result(alpha.id)])
    fake_stream_answer(["partial", "never"], fail_after=1)

    events = await _events(await _post("/portfolio/ask", {"question": "q"}))

    assert events[-1] == {"error": "The answer was cut off.", "fallback": True}
    assert (await PortfolioQuery.objects.aget()).outcome == "failed"


@pytest.mark.django_db(transaction=True)
async def test_nothing_indexed_refuses_with_fallback(corpus_dir, fake_search, fake_stream_answer):
    corpus_dir({"alpha": "text"})
    response = await _post("/portfolio/ask", {"question": "anything"})
    assert response.status_code == 503
    assert json.loads(response.content)["fallback"] is True


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("body", [{}, {"question": "   "}, {"question": 7}])
async def test_ask_rejects_an_empty_question(body):
    response = await _post("/portfolio/ask", body)
    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
async def test_ask_rejects_an_overlong_question():
    response = await _post(
        "/portfolio/ask", {"question": "x" * (portfolio_settings.max_question_chars + 1)}
    )
    assert response.status_code == 400


@pytest.mark.django_db(transaction=True)
async def test_ask_is_post_only():
    assert (await AsyncClient().get("/portfolio/ask")).status_code == 405


@pytest.mark.django_db(transaction=True)
async def test_per_ip_rate_limit(indexed, fake_search, fake_stream_answer, monkeypatch):
    monkeypatch.setattr(portfolio_settings, "per_ip_per_minute", 2)
    alpha = indexed["alpha"]
    fake_search(lambda ids: [_result(alpha.id)])
    fake_stream_answer(["ok"])

    statuses = []
    for _ in range(3):
        response = await _post(
            "/portfolio/ask", {"question": "q"}, headers={"X-Forwarded-For": "203.0.113.9"}
        )
        statuses.append(response.status_code)
        if response.status_code == 200:
            await _events(response)
    other = await _post(
        "/portfolio/ask", {"question": "q"}, headers={"X-Forwarded-For": "198.51.100.4"}
    )

    assert statuses == [200, 200, 429]
    assert other.status_code == 200


@pytest.mark.django_db(transaction=True)
async def test_daily_cap_pauses_live_answers(indexed, fake_search, fake_stream_answer, monkeypatch):
    monkeypatch.setattr(portfolio_settings, "daily_request_cap", 1)
    await PortfolioQuery.objects.acreate(kind="ask", text="earlier", outcome="answered")

    response = await _post("/portfolio/ask", {"question": "q"})

    assert response.status_code == 503
    assert json.loads(response.content) == {
        "detail": "Live answers are paused for today.",
        "fallback": True,
    }


@pytest.mark.django_db(transaction=True)
async def test_portfolio_requests_never_provision_a_visitor(
    indexed, fake_search, fake_stream_answer
):
    alpha = indexed["alpha"]
    fake_search(lambda ids: [_result(alpha.id)])
    fake_stream_answer(["ok"])
    before = await User.objects.acount()

    await _events(await _post("/portfolio/ask", {"question": "q"}))
    await _post("/portfolio/message", {"email": "a@example.com", "text": "hi"})

    assert await User.objects.acount() == before


@pytest.mark.django_db(transaction=True)
async def test_message_is_stored_then_emailed(settings, monkeypatch):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    monkeypatch.setattr(portfolio_settings, "owner_email", "owner@example.com")

    response = await _post(
        "/portfolio/message", {"name": "Ada", "email": "ada@example.com", "text": "Let's talk"}
    )

    assert response.status_code == 201
    contact = await ContactMessage.objects.aget()
    assert (contact.name, contact.email, contact.text, contact.notified) == (
        "Ada",
        "ada@example.com",
        "Let's talk",
        True,
    )
    assert mail.outbox[-1].to == ["owner@example.com"]
    assert "Let's talk" in mail.outbox[-1].body


@pytest.mark.django_db(transaction=True)
async def test_message_survives_a_mail_outage(monkeypatch):
    monkeypatch.setattr(portfolio_settings, "owner_email", "owner@example.com")

    def broken_send_mail(**kwargs):
        raise ConnectionError("smtp down")

    from apps.portfolio.api import views

    monkeypatch.setattr(views, "send_mail", broken_send_mail)

    response = await _post("/portfolio/message", {"email": "ada@example.com", "text": "hi"})

    assert response.status_code == 201
    assert (await ContactMessage.objects.aget()).notified is False


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize(
    "body",
    [{"text": "hi"}, {"email": "ada@example.com"}, {"email": "not-an-email", "text": "hi"}],
)
async def test_message_validation(body):
    assert (await _post("/portfolio/message", body)).status_code == 400
    assert await ContactMessage.objects.acount() == 0


@pytest.mark.django_db(transaction=True)
async def test_message_rate_limit(monkeypatch):
    monkeypatch.setattr(portfolio_settings, "messages_per_ip_per_hour", 1)
    first = await _post("/portfolio/message", {"email": "a@example.com", "text": "one"})
    second = await _post("/portfolio/message", {"email": "a@example.com", "text": "two"})
    assert (first.status_code, second.status_code) == (201, 429)


@pytest.mark.django_db
def test_purge_deletes_only_expired_queries():
    old = PortfolioQuery.objects.create(kind="ask", text="old", outcome="answered")
    PortfolioQuery.objects.filter(id=old.id).update(
        created_at=timezone.now() - timedelta(days=portfolio_settings.query_retention_days + 1)
    )
    PortfolioQuery.objects.create(kind="ask", text="new", outcome="answered")

    call_command("purge_portfolio_queries")

    assert list(PortfolioQuery.objects.values_list("text", flat=True)) == ["new"]
