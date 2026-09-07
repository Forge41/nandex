"""Two-layer retry: tenacity wraps the raw provider HTTP call (fast, fine-grained,
Retry-After-aware); Temporal's own per-activity RetryPolicy sits above that (coarser,
catches whatever tenacity gave up on). See the importer LLD's retry section for why both
layers exist.
"""

from datetime import timedelta

from temporalio.exceptions import ApplicationError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from apps.importer.errors import (
    PermanentProviderError,
    ProviderError,
    RateLimitedError,
    TransientProviderError,
)


def wait_provider(retry_state) -> float:
    """Exponential backoff by default, but a RateLimitedError with a known retry_after
    value is used verbatim instead of guessing — the provider already told us."""
    exc = retry_state.outcome.exception() if retry_state.outcome else None
    if isinstance(exc, RateLimitedError) and exc.retry_after is not None:
        return exc.retry_after
    return wait_exponential(multiplier=0.5, max=10)(retry_state)


provider_retry = retry(
    retry=retry_if_exception_type(TransientProviderError),
    wait=wait_provider,
    stop=stop_after_attempt(5),
    reraise=True,
)


def as_temporal_error(exc: ProviderError) -> ApplicationError:
    """Converts a ProviderError that survived tenacity's retries into a Temporal
    ApplicationError. A RateLimitedError carries next_retry_delay so Temporal's own
    RetryPolicy honors the provider's actual Retry-After instead of a blind exponential
    guess — without this, that information is lost the moment tenacity gives up.
    """
    next_retry_delay = None
    if isinstance(exc, RateLimitedError) and exc.retry_after is not None:
        next_retry_delay = timedelta(seconds=exc.retry_after)

    return ApplicationError(
        str(exc),
        type=type(exc).__name__,
        non_retryable=isinstance(exc, PermanentProviderError),
        next_retry_delay=next_retry_delay,
    )
