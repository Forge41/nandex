"""The callback signature is computed over the exact bytes that go on the wire. The
receiver in apps.interview verifies against request.body for the same reason.
"""

import json

from apps.vas_recordings.activities import sign_callback

SECRET = "callback-secret-at-least-32-bytes-long"


def test_the_signature_covers_the_body_bytes_not_the_parsed_value():
    payload = {"a": 1, "b": 2}
    raw = json.dumps(payload).encode()
    reserialized = json.dumps({"b": 2, "a": 1}, separators=(", ", ": ")).encode()

    assert json.loads(raw) == json.loads(reserialized)
    assert sign_callback(raw, "1700000000", SECRET) != sign_callback(
        reserialized, "1700000000", SECRET
    )


def test_the_timestamp_is_part_of_the_signature():
    raw = b'{"a":1}'
    assert sign_callback(raw, "1700000000", SECRET) != sign_callback(raw, "1700000001", SECRET)


def test_the_signature_is_deterministic_for_the_same_inputs():
    raw = b'{"a":1}'
    assert sign_callback(raw, "1700000000", SECRET) == sign_callback(raw, "1700000000", SECRET)
