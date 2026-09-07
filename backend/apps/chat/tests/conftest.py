import pytest

from apps.chat import scoping, service


@pytest.fixture
def fake_connections(monkeypatch):
    def _set(connections):
        async def list_connections(project_id):
            return connections

        monkeypatch.setattr(scoping.tps_client, "list_connections", list_connections)

    return _set


@pytest.fixture
def fake_search(monkeypatch):
    def _set(results):
        def search(query, raw_document_ids=None, top_k=None):
            return results

        monkeypatch.setattr(service, "search", search)

    return _set


@pytest.fixture
def fake_stream_answer(monkeypatch):
    def _set(deltas):
        async def stream_answer(*, system_prompt, messages, model="claude-sonnet-4-5"):
            for delta in deltas:
                yield delta

        monkeypatch.setattr(service, "stream_answer", stream_answer)

    return _set
