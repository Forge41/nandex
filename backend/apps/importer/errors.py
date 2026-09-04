"""Provider error hierarchy — shared across every provider adapter, and understood by
both the tenacity retry layer (retry.py) and the Temporal activities that call adapters.
"""


class ProviderError(Exception):
    """Base for every error a provider adapter can raise."""


class TransientProviderError(ProviderError):
    """Timeout, connection error, 5xx — worth retrying."""


class RateLimitedError(TransientProviderError):
    """429, or a 403 that's actually a quota problem, not a permission problem."""

    def __init__(self, message: str, retry_after: float | None = None):
        super().__init__(message)
        self.retry_after = retry_after


class PermanentProviderError(ProviderError):
    """4xx other than a rate limit, or a malformed response. Not retryable."""


class AuthExpiredError(PermanentProviderError):
    """Token invalid even after tps's own refresh attempt."""
