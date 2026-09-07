import json

import pytest
from asgiref.sync import sync_to_async
from django.test import AsyncClient

from apps.chat.models import Message
from apps.retrieval.results import SearchResult


async def _logged_in_async_client() -> AsyncClient:
    from django.core import mail

    client = AsyncClient()
    await client.post(
        "/auth/login", data={"email": "chat-tester@example.com"}, content_type="application/json"
    )
    body = mail.outbox[-1].body
    token = body.split("token=")[1].strip().split()[0]
    resp = await client.post("/auth/verify", data={"token": token}, content_type="application/json")
    assert resp.status_code == 200
    return client


@pytest.fixture
def logged_in_async_client(db, settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
    return _logged_in_async_client


@pytest.mark.django_db(transaction=True)
async def test_conversations_requires_auth():
    from django.test import AsyncClient

    resp = await AsyncClient().get("/chat/conversations")
    assert resp.status_code == 401


@pytest.mark.django_db(transaction=True)
async def test_create_list_and_load_conversation(logged_in_async_client):
    client = await logged_in_async_client()

    create_resp = await client.post(
        "/chat/conversations", data={"project_id": "proj-1"}, content_type="application/json"
    )
    assert create_resp.status_code == 201
    conversation_id = json.loads(create_resp.content)["id"]

    list_resp = await client.get("/chat/conversations?project_id=proj-1")
    assert [c["id"] for c in json.loads(list_resp.content)] == [conversation_id]

    detail_resp = await client.get(f"/chat/conversations/{conversation_id}")
    assert detail_resp.status_code == 200
    assert json.loads(detail_resp.content)["messages"] == []


@pytest.mark.django_db(transaction=True)
async def test_conversation_detail_not_owned_404s(logged_in_async_client):
    client = await logged_in_async_client()
    resp = await client.get("/chat/conversations/does-not-exist")
    assert resp.status_code == 404


@pytest.mark.django_db(transaction=True)
async def test_post_message_streams_sse_and_persists(
    logged_in_async_client, fake_connections, fake_search, fake_stream_answer
):
    fake_connections([])
    fake_search(
        [
            SearchResult(
                chunk_id="chunk-1",
                raw_document_id="doc-1",
                content="context",
                page_idx=None,
                start_idx=None,
                end_idx=None,
                metadata={},
                score=1.0,
            )
        ]
    )
    fake_stream_answer(["The answer"])

    client = await logged_in_async_client()
    create_resp = await client.post(
        "/chat/conversations", data={"project_id": "proj-1"}, content_type="application/json"
    )
    conversation_id = json.loads(create_resp.content)["id"]

    resp = await client.post(
        f"/chat/conversations/{conversation_id}/messages",
        data={"message": "hi?"},
        content_type="application/json",
    )
    assert resp.status_code == 200
    assert resp["Content-Type"] == "text/event-stream"
    body = b"".join([chunk async for chunk in resp.streaming_content]).decode()
    assert "data: " in body
    assert '"done": true' in body

    message_count = await sync_to_async(
        lambda: Message.objects.filter(conversation_id=conversation_id).count()
    )()
    assert message_count == 2
