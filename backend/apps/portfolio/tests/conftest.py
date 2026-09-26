import pytest
from django.core.cache import cache

from apps.portfolio import service
from apps.portfolio.config import settings as portfolio_settings


@pytest.fixture(autouse=True)
def clear_rate_limits():
    cache.clear()
    yield
    cache.clear()


@pytest.fixture
def corpus_dir(tmp_path, monkeypatch):
    def write(sources: dict[str, str]):
        for path in tmp_path.glob("*.md"):
            path.unlink()
        for source_id, text in sources.items():
            (tmp_path / f"{source_id}.md").write_text(
                f"---\ndoc: resume.pdf\ntitle: {source_id.title()}\n---\n\n{text}\n"
            )

    monkeypatch.setattr(portfolio_settings, "corpus_dir", tmp_path)
    return write


@pytest.fixture
def fake_search(monkeypatch):
    calls = []

    def _set(results_for):
        def search(query, raw_document_ids=None, top_k=None):
            calls.append({"query": query, "raw_document_ids": raw_document_ids, "top_k": top_k})
            return results_for(raw_document_ids or [])

        monkeypatch.setattr(service, "search", search)
        return calls

    return _set


@pytest.fixture
def fake_stream_answer(monkeypatch):
    requests = []

    def _set(deltas, fail_after=None):
        async def stream_answer(*, system_prompt, messages, model, max_tokens=None, usage=None):
            requests.append(
                {
                    "system_prompt": system_prompt,
                    "messages": messages,
                    "model": model,
                    "max_tokens": max_tokens,
                }
            )
            for i, delta in enumerate(deltas):
                if fail_after is not None and i == fail_after:
                    raise RuntimeError("upstream dropped")
                yield delta
            if usage is not None:
                usage["output_tokens"] = 42

        monkeypatch.setattr(service, "stream_answer", stream_answer)
        return requests

    return _set
