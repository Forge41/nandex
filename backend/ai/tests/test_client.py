import pytest

from ai import client as client_module
from ai.client import stream_answer


class _FakeStream:
    def __init__(self, chunks):
        self._chunks = chunks

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    @property
    def text_stream(self):
        async def _gen():
            for chunk in self._chunks:
                yield chunk

        return _gen()


class _FakeMessages:
    def __init__(self, chunks):
        self._chunks = chunks

    def stream(self, **kwargs):
        return _FakeStream(self._chunks)


class _FakeAsyncAnthropic:
    def __init__(self, *args, **kwargs):
        self.messages = _FakeMessages(["Hel", "lo", " world"])


@pytest.fixture
def fake_anthropic(monkeypatch):
    monkeypatch.setattr(client_module.anthropic, "AsyncAnthropic", _FakeAsyncAnthropic)


@pytest.mark.asyncio
async def test_stream_answer_yields_text_deltas(fake_anthropic):
    deltas = [chunk async for chunk in stream_answer(system_prompt="be helpful", messages=[])]
    assert "".join(deltas) == "Hello world"
