"""The validator's contract is that every rejection is a ValueError.

Both cases here were found by running a real LiveKit server against the service: a
malformed Authorization header raised PyJWT's DecodeError, which is not a ValueError, so
it escaped the view and became a 500. A 5xx makes the provider retry forever over a
request that can never succeed.
"""

import pytest

from apps.vas_recordings.providers.livekit import LiveKitWebhookValidator

VALIDATOR = LiveKitWebhookValidator("devkey", "devsecret-at-least-32-bytes-long", 300)


@pytest.mark.parametrize(
    "auth_header",
    [
        pytest.param("", id="absent"),
        pytest.param("not-a-jwt", id="not a jwt"),
        pytest.param("Bearer not-a-jwt", id="bearer prefixed garbage"),
        pytest.param("a.b", id="too few jwt segments"),
        pytest.param("a.b.c", id="right shape, undecodable"),
    ],
)
def test_every_bad_authorization_header_is_a_value_error(auth_header):
    with pytest.raises(ValueError):
        VALIDATOR.validate_and_parse(b'{"event":"room_started"}', auth_header)


def test_a_body_that_is_not_utf8_is_a_value_error_not_a_unicode_error():
    with pytest.raises(ValueError):
        VALIDATOR.validate_and_parse(b"\xff\xfe not utf-8", "a.b.c")
