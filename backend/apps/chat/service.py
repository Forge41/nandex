"""Orchestrates one turn: resolve scope -> retrieve -> generate -> persist. Sources are
attached as a structured citation list from the retrieval results actually used, never
parsed out of the model's own generated text -- see ai/prompts/chat_system.md.
"""

import json
from collections.abc import AsyncIterator

from ai.client import stream_answer
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.chat.config import settings
from apps.chat.models import Conversation, Message
from apps.chat.scoping import resolve_visible_raw_document_ids
from apps.retrieval.search import search


async def ask(*, conversation: Conversation, question: str) -> AsyncIterator[str]:
    doc_ids = await resolve_visible_raw_document_ids(conversation.project_id)
    results = await sync_to_async(search, thread_sensitive=True)(
        question, raw_document_ids=doc_ids, top_k=settings.default_top_k
    )

    system_prompt = load_prompt("chat_system.md")
    context = "\n\n".join(f"[{r.chunk_id}] {r.content}" for r in results)
    user_turn = load_prompt("chat_user_turn.md").format(question=question, context=context)

    await Message.objects.acreate(
        conversation=conversation, role=Message.Role.USER, content=question
    )

    answer_parts: list[str] = []
    async for delta in stream_answer(
        system_prompt=system_prompt, messages=[{"role": "user", "content": user_turn}]
    ):
        answer_parts.append(delta)
        yield f"data: {json.dumps({'delta': delta})}\n\n"

    citations = [
        {"chunk_id": r.chunk_id, "raw_document_id": r.raw_document_id, "page_idx": r.page_idx}
        for r in results
    ]
    await Message.objects.acreate(
        conversation=conversation,
        role=Message.Role.ASSISTANT,
        content="".join(answer_parts),
        citations=citations,
    )
    yield f"data: {json.dumps({'done': True, 'citations': citations})}\n\n"
