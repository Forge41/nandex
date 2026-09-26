from types import SimpleNamespace
from typing import ClassVar

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

    async def get_final_message(self):
        return SimpleNamespace(usage=SimpleNamespace(output_tokens=3))


class _FakeMessages:
    last_request: ClassVar[dict] = {}

    def __init__(self, chunks):
        self._chunks = chunks

    def stream(self, **kwargs):
        _FakeMessages.last_request = kwargs
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


@pytest.mark.asyncio
async def test_stream_answer_lowers_max_tokens_and_reports_usage(fake_anthropic):
    usage: dict = {}
    deltas = [
        chunk
        async for chunk in stream_answer(
            system_prompt="s", messages=[], max_tokens=600, usage=usage
        )
    ]
    assert "".join(deltas) == "Hello world"
    assert _FakeMessages.last_request["max_tokens"] == 600
    assert usage == {"output_tokens": 3}


@pytest.mark.asyncio
async def test_stream_answer_never_raises_max_tokens_above_the_model_ceiling(fake_anthropic):
    [chunk async for chunk in stream_answer(system_prompt="s", messages=[], max_tokens=10**6)]
    assert _FakeMessages.last_request["max_tokens"] == 8192
