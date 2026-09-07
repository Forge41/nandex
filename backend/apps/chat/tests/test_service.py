import json

import pytest

from apps.chat.models import Conversation, Message
from apps.chat.service import ask
from apps.retrieval.results import SearchResult


@pytest.mark.django_db(transaction=True)
async def test_ask_persists_messages_and_streams_citations(
    fake_connections, fake_search, fake_stream_answer
):
    fake_connections([])
    fake_search(
        [
            SearchResult(
                chunk_id="chunk-1",
                raw_document_id="doc-1",
                content="the answer lives here",
                page_idx=0,
                start_idx=None,
                end_idx=None,
                metadata={},
                score=1.0,
            )
        ]
    )
    fake_stream_answer(["Hel", "lo"])

    conversation = await Conversation.objects.acreate(project_id="proj-1", user_id="user-1")

    events = [event async for event in ask(conversation=conversation, question="hi?")]

    deltas = [json.loads(e.removeprefix("data: "))["delta"] for e in events[:-1]]
    assert "".join(deltas) == "Hello"

    final = json.loads(events[-1].removeprefix("data: "))
    assert final["done"] is True
    assert final["citations"] == [
        {"chunk_id": "chunk-1", "raw_document_id": "doc-1", "page_idx": 0}
    ]

    messages = [
        m async for m in Message.objects.filter(conversation=conversation).order_by("created_at")
    ]
    assert [m.role for m in messages] == [Message.Role.USER, Message.Role.ASSISTANT]
    assert messages[0].content == "hi?"
    assert messages[1].content == "Hello"
    assert messages[1].citations == final["citations"]
