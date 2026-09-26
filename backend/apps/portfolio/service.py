"""One portfolio answer: scope to the current corpus -> retrieve -> stream -> log.

Unlike apps.chat, the model is asked to cite inline as `[source-id]`, because the page
numbers citations per sentence. The ids it may use are exactly the retrieved ones, sent to
the page first, and the page drops any marker outside that list.
"""

import json
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass

from ai.client import stream_answer
from ai.prompt_loader import load_prompt
from asgiref.sync import sync_to_async

from apps.importer.models import RawDocument
from apps.portfolio.config import settings
from apps.portfolio.corpus import Source, load_corpus
from apps.portfolio.models import PortfolioQuery
from apps.retrieval.search import search

logger = logging.getLogger(__name__)

_PROMPTS = {
    PortfolioQuery.Kind.ASK: ("portfolio_ask_system.md", "portfolio_ask_user_turn.md"),
    PortfolioQuery.Kind.FIT: ("portfolio_fit_system.md", "portfolio_fit_user_turn.md"),
}


@dataclass(frozen=True)
class Passage:
    source: Source
    content: str


def current_documents_sync() -> dict[str, Source]:
    """raw_document_id -> Source for the newest stored version of each source still in the
    corpus. Older versions and removed sources stay in the table (RawDocument is
    immutable) but fall out of scope here."""
    corpus = {source.provider_document_id: source for source in load_corpus(settings.corpus_dir)}
    rows = (
        RawDocument.objects.filter(
            project_id=settings.project_id, provider_document_id__in=corpus.keys()
        )
        .order_by("provider_document_id", "-fetched_at")
        .distinct("provider_document_id")
        .values_list("id", "provider_document_id")
    )
    return {doc_id: corpus[provider_id] for doc_id, provider_id in rows}


def retrieve_sync(text: str) -> list[Passage]:
    documents = current_documents_sync()
    if not documents:
        return []
    results = search(text, raw_document_ids=list(documents), top_k=settings.top_k)
    return [Passage(source=documents[r.raw_document_id], content=r.content) for r in results]


async def retrieve(text: str) -> list[Passage]:
    return await sync_to_async(retrieve_sync, thread_sensitive=True)(text)


def _event(payload: dict) -> str:
    return f"data: {json.dumps(payload)}\n\n"


async def stream(kind: str, text: str, passages: list[Passage]) -> AsyncIterator[str]:
    started = time.monotonic()
    sources = list({p.source.id: p.source for p in passages}.values())
    yield _event({"retrieved": [{"id": s.id, "doc": s.doc, "title": s.title} for s in sources]})

    system_name, user_turn_name = _PROMPTS[kind]
    context = "\n\n".join(
        f"[{p.source.id}] ({p.source.display_name})\n{p.content}" for p in passages
    )
    user_turn = load_prompt(user_turn_name).format(text=text, context=context)

    answer: list[str] = []
    usage: dict = {}
    outcome = PortfolioQuery.Outcome.ANSWERED
    try:
        async for delta in stream_answer(
            system_prompt=load_prompt(system_name),
            messages=[{"role": "user", "content": user_turn}],
            model=settings.model,
            max_tokens=settings.max_output_tokens,
            usage=usage,
        ):
            answer.append(delta)
            yield _event({"delta": delta})
    except Exception:
        logger.exception("Portfolio %s answer failed mid-stream", kind)
        outcome = PortfolioQuery.Outcome.FAILED
        yield _event({"error": "The answer was cut off.", "fallback": True})

    latency_ms = int((time.monotonic() - started) * 1000)
    await PortfolioQuery.objects.acreate(
        kind=kind,
        text=text,
        retrieved=[s.id for s in sources],
        answer="".join(answer),
        outcome=outcome,
        latency_ms=latency_ms,
        output_tokens=usage.get("output_tokens", 0),
    )
    if outcome == PortfolioQuery.Outcome.ANSWERED:
        yield _event(
            {"done": True, "latency_ms": latency_ms, "output_tokens": usage.get("output_tokens", 0)}
        )
