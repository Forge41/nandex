import json

import pytest
from django.test import AsyncClient

from apps.core.services.room_service import RoomUnavailable
from apps.importer.models import RawDocument
from apps.portfolio import voice
from apps.portfolio.config import settings as portfolio_settings
from apps.portfolio.models import PortfolioQuery
from apps.retrieval.results import SearchResult

AGENT_TOKEN = "agent-secret"


@pytest.fixture
def voice_on(monkeypatch):
    monkeypatch.setattr(portfolio_settings, "voice_enabled", True)


@pytest.fixture
def fake_mint(monkeypatch):
    calls = []

    async def mint_join_token(project_id, room, identity, *, ttl_seconds, agents):
        calls.append(
            {"project_id": project_id, "room": room, "identity": identity, "agents": agents}
        )
        return {"token": "jwt", "ws_url": "wss://lk.example", "expires_in": ttl_seconds}

    monkeypatch.setattr(voice.room_service, "mint_join_token", mint_join_token)
    return calls


async def _post(path, body=None, headers=None):
    return await AsyncClient().post(
        path, data=body or {}, content_type="application/json", headers=headers
    )


@pytest.mark.django_db(transaction=True)
async def test_voice_token_dispatches_the_shared_agent_in_portfolio_mode(voice_on, fake_mint):
    response = await _post("/portfolio/voice/token")

    assert response.status_code == 201
    body = json.loads(response.content)
    assert (body["token"], body["ws_url"]) == ("jwt", "wss://lk.example")
    assert body["room_name"].startswith("portfolio-")
    assert body["identity"].startswith("visitor-")

    [call] = fake_mint
    assert call["project_id"] == portfolio_settings.project_id
    [(agent_name, metadata)] = call["agents"]
    assert agent_name == portfolio_settings.agent_name
    assert json.loads(metadata) == {
        "mode": "portfolio",
        "max_minutes": portfolio_settings.voice_max_minutes,
    }


@pytest.mark.django_db(transaction=True)
async def test_each_visitor_gets_their_own_room(voice_on, fake_mint):
    await _post("/portfolio/voice/token", headers={"X-Forwarded-For": "203.0.113.1"})
    await _post("/portfolio/voice/token", headers={"X-Forwarded-For": "203.0.113.2"})
    assert fake_mint[0]["room"] != fake_mint[1]["room"]
    assert fake_mint[0]["identity"] != fake_mint[1]["identity"]


@pytest.mark.django_db(transaction=True)
async def test_voice_is_refused_with_fallback_while_disabled(fake_mint):
    response = await _post("/portfolio/voice/token")
    assert response.status_code == 503
    assert json.loads(response.content)["fallback"] is True
    assert fake_mint == []


@pytest.mark.django_db(transaction=True)
async def test_voice_sessions_are_limited_per_ip(voice_on, fake_mint, monkeypatch):
    monkeypatch.setattr(portfolio_settings, "voice_sessions_per_ip_per_day", 1)
    first = await _post("/portfolio/voice/token")
    second = await _post("/portfolio/voice/token")
    assert (first.status_code, second.status_code) == (201, 429)


@pytest.mark.django_db(transaction=True)
async def test_an_unavailable_room_service_falls_back(voice_on, monkeypatch):
    async def unavailable(*args, **kwargs):
        raise RoomUnavailable("down")

    monkeypatch.setattr(voice.room_service, "mint_join_token", unavailable)
    response = await _post("/portfolio/voice/token")
    assert response.status_code == 503
    assert json.loads(response.content)["fallback"] is True


@pytest.fixture
def agent_token(monkeypatch):
    monkeypatch.setattr(portfolio_settings, "agent_bearer_token", AGENT_TOKEN)


@pytest.mark.django_db(transaction=True)
async def test_agent_passages_returns_retrieved_text_and_logs_it(
    agent_token, corpus_dir, fake_search
):
    corpus_dir({"alpha": "Built a RAG pipeline."})
    document = await RawDocument.objects.acreate(
        connection_id="upload",
        project_id="portfolio",
        provider_document_id="portfolio:alpha",
        provider_version="v1",
        payload=b"x",
    )
    fake_search(
        lambda ids: [
            SearchResult(
                chunk_id="c1",
                raw_document_id=document.id,
                content="Built a RAG pipeline.",
                page_idx=None,
                start_idx=None,
                end_idx=None,
                metadata={},
                score=1.0,
            )
        ]
    )

    response = await _post(
        "/portfolio/agent/passages",
        {"question": "what did you build?"},
        headers={"Authorization": f"Bearer {AGENT_TOKEN}"},
    )

    assert response.status_code == 200
    assert json.loads(response.content) == {
        "passages": [
            {
                "id": "alpha",
                "doc": "resume.pdf",
                "title": "Alpha",
                "content": "Built a RAG pipeline.",
            }
        ]
    }
    query = await PortfolioQuery.objects.aget()
    assert (query.kind, query.retrieved) == ("voice", ["alpha"])


@pytest.mark.django_db(transaction=True)
@pytest.mark.parametrize("header", [None, "Bearer wrong", AGENT_TOKEN])
async def test_agent_passages_requires_the_agent_token(agent_token, header):
    headers = {"Authorization": header} if header else None
    response = await _post("/portfolio/agent/passages", {"question": "q"}, headers=headers)
    assert response.status_code == 401


@pytest.mark.django_db(transaction=True)
async def test_agent_passages_rejects_everything_when_no_token_is_configured():
    response = await _post(
        "/portfolio/agent/passages", {"question": "q"}, headers={"Authorization": "Bearer "}
    )
    assert response.status_code == 401
