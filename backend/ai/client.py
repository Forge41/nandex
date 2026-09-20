import logging
from collections.abc import AsyncIterator

import anthropic

from ai.config import settings
from ai.models import FAST_MODE_BETA, MODEL_REGISTRY

logger = logging.getLogger(__name__)


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


async def complete(
    *,
    system_prompt: str,
    messages: list[dict],
    model: str = "claude-sonnet-4-5",
    fast: bool = False,
    effort: str = "",
) -> str:
    """The whole response, for callers that need to parse it rather than show it.

    Streaming exists so a reader sees the answer forming; a caller parsing JSON cannot use
    a partial response, so there is nothing to gain from it here.

    `fast` asks for the fast-mode beta, which is 3-4x the output rate and is what makes
    the interview plan bearable to wait for. It is a request, not a guarantee: it has its
    own rate limit, so a 429 falls back to the ordinary path rather than failing a
    candidate's upload. A model with no fast variant takes the ordinary path too.
    """
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    model_config = MODEL_REGISTRY[model]
    request = {
        "model": model_config["id"],
        "max_tokens": model_config["max_tokens"],
        "system": system_prompt,
        "messages": messages,
    }

    if fast and model_config.get("fast"):
        try:
            return _text_of(
                await client.beta.messages.create(
                    betas=[FAST_MODE_BETA],
                    speed="fast",
                    output_config={"effort": effort or "low"},
                    **request,
                )
            )
        except anthropic.RateLimitError:
            # Fast mode's limit is separate from the model's own, so the slower path is
            # very likely still open. Switching speed invalidates the prompt cache, which
            # costs nothing here -- each resume is a different prompt.
            logger.warning("Fast mode is rate limited; falling back to %s at its own speed.", model)
    elif effort:
        return _text_of(
            await client.beta.messages.create(output_config={"effort": effort}, **request)
        )

    return _text_of(await client.messages.create(**request))


def _text_of(response) -> str:
    return "".join(block.text for block in response.content if block.type == "text")
