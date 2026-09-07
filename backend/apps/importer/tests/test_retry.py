from unittest.mock import MagicMock

from apps.importer.errors import PermanentProviderError, RateLimitedError, TransientProviderError
from apps.importer.retry import as_temporal_error, wait_provider


def _retry_state_with_exception(exc: Exception, attempt_number: int = 1):
    state = MagicMock()
    state.outcome.exception.return_value = exc
    state.attempt_number = attempt_number
    return state


def test_wait_provider_honors_retry_after_when_present():
    state = _retry_state_with_exception(RateLimitedError("rate limited", retry_after=42.0))
    assert wait_provider(state) == 42.0


def test_wait_provider_falls_back_to_exponential_without_retry_after():
    state = _retry_state_with_exception(RateLimitedError("rate limited", retry_after=None))
    # exponential wait_exponential(multiplier=0.5, max=10) — not exactly 42, and capped
    assert wait_provider(state) != 42.0
    assert wait_provider(state) <= 10


def test_wait_provider_falls_back_to_exponential_for_non_rate_limit_errors():
    state = _retry_state_with_exception(TransientProviderError("timeout"))
    assert wait_provider(state) <= 10


def test_as_temporal_error_carries_next_retry_delay_for_rate_limited():
    error = as_temporal_error(RateLimitedError("rate limited", retry_after=90.0))
    assert error.next_retry_delay.total_seconds() == 90.0
    assert error.non_retryable is False


def test_as_temporal_error_no_delay_when_retry_after_unknown():
    error = as_temporal_error(RateLimitedError("rate limited", retry_after=None))
    assert error.next_retry_delay is None


def test_as_temporal_error_marks_permanent_errors_non_retryable():
    error = as_temporal_error(PermanentProviderError("nope"))
    assert error.non_retryable is True
    assert error.next_retry_delay is None


def test_as_temporal_error_marks_transient_errors_retryable():
    error = as_temporal_error(TransientProviderError("network blip"))
    assert error.non_retryable is False
