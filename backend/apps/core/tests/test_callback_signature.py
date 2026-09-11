"""The callback signature is a contract between two deployables, so it is tested against
vas's real signing function rather than a reimplementation of it.

Importing apps.vas_recordings here would violate the leaf rule in production code. In a
test it is the point: if either side changes the message construction, this fails instead
of every recording silently never being reported.
"""

import json
import time

import pytest

from apps.core.services import room_service
from apps.vas_recordings.activities import sign_callback

SECRET = "shared-callback-secret-at-least-32-bytes"


@pytest.fixture(autouse=True)
def _shared_secret(monkeypatch):
    monkeypatch.setattr(room_service.settings, "vas_callback_signing_secret", SECRET)


def _signed(payload: dict, *, at: int | None = None) -> tuple[bytes, str, str]:
    raw = json.dumps(payload).encode()
    timestamp = str(at if at is not None else int(time.time()))
    return raw, f"sha256={sign_callback(raw, timestamp, SECRET)}", timestamp


def test_a_callback_vas_signed_verifies_here():
    raw, signature, timestamp = _signed({"event": "recording.complete", "recording": {"id": "r1"}})
    assert room_service.verify_callback_signature(raw, signature, timestamp) is True


def test_a_bare_hex_signature_without_the_prefix_also_verifies():
    """The prefix is a convention, not part of the digest."""
    raw, signature, timestamp = _signed({"event": "recording.complete"})
    assert room_service.verify_callback_signature(
        raw, signature.removeprefix("sha256="), timestamp
    ) is True


def test_a_semantically_identical_but_reserialized_body_fails():
    payload = {"a": 1, "b": 2}
    _, signature, timestamp = _signed(payload)
    reserialized = json.dumps({"b": 2, "a": 1}, separators=(", ", ": ")).encode()

    assert json.loads(reserialized) == payload
    assert room_service.verify_callback_signature(reserialized, signature, timestamp) is False


def test_a_tampered_body_fails():
    raw, signature, timestamp = _signed({"event": "recording.complete", "duration_seconds": 1.0})
    tampered = raw.replace(b"1.0", b"9.0")
    assert room_service.verify_callback_signature(tampered, signature, timestamp) is False


def test_a_stale_timestamp_fails_even_with_a_valid_signature():
    """Replay defence: the signature stays valid forever, the window does not."""
    stale = int(time.time()) - room_service.CALLBACK_MAX_SKEW_SECONDS - 60
    raw, signature, timestamp = _signed({"event": "recording.complete"}, at=stale)

    assert room_service.verify_callback_signature(raw, signature, timestamp) is False


def test_a_timestamp_too_far_in_the_future_fails():
    ahead = int(time.time()) + room_service.CALLBACK_MAX_SKEW_SECONDS + 60
    raw, signature, timestamp = _signed({"event": "recording.complete"}, at=ahead)

    assert room_service.verify_callback_signature(raw, signature, timestamp) is False


@pytest.mark.parametrize(
    ("signature", "timestamp"),
    [
        pytest.param("", "", id="both empty"),
        pytest.param("sha256=", "1700000000", id="empty digest"),
        pytest.param("sha256=zz", "not-a-number", id="unparseable timestamp"),
        pytest.param("sha256=zz", "", id="missing timestamp"),
    ],
)
def test_a_malformed_header_returns_false_rather_than_raising(signature, timestamp):
    assert room_service.verify_callback_signature(b"{}", signature, timestamp) is False


def test_an_unset_secret_rejects_rather_than_accepting_anything(monkeypatch):
    """A misconfigured deployment should drop callbacks, not trust anonymous ones."""
    raw, signature, timestamp = _signed({"event": "recording.complete"})
    monkeypatch.setattr(room_service.settings, "vas_callback_signing_secret", "")

    assert room_service.verify_callback_signature(raw, signature, timestamp) is False


def test_a_different_secret_fails():
    raw, _, timestamp = _signed({"event": "recording.complete"})
    wrong = f"sha256={sign_callback(raw, timestamp, 'a-different-secret-of-the-same-length')}"

    assert room_service.verify_callback_signature(raw, wrong, timestamp) is False
