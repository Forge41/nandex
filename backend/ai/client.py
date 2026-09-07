from collections.abc import AsyncIterator

import anthropic

from ai.config import settings
from ai.models import MODEL_REGISTRY


async def stream_answer(
    *, system_prompt: str, messages: list[dict], model: str = "claude-sonnet-4-5"
) -> AsyncIterator[str]:
    """Yields text deltas only -- caller owns prompt assembly, citations, and persistence."""
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    model_config = MODEL_REGISTRY[model]
    async with client.messages.stream(
        model=model_config["id"],
        max_tokens=model_config["max_tokens"],
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
