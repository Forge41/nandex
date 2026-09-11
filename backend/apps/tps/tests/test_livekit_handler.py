"""The claims in the minted JWT are the contract: the browser presents this token to a
LiveKit server we do not control, so a wrong or missing claim fails at join time with no
earlier signal. Decode and assert them rather than trusting the builder.
"""

import jwt
import pytest

from apps.tps.handlers import get_credential_handler, get_realtime_handler
from apps.tps.handlers.base import AgentDispatch, RoomGrants
from apps.tps.handlers.livekit import LiveKitHandler

CONFIG = {
    "host": "wss://livekit.example",
    "api_key": "devkey",
    "api_secret": "a-test-secret-at-least-32-bytes-long",
}


def _claims(token: str) -> dict:
    return jwt.decode(token, CONFIG["api_secret"], algorithms=["HS256"])


def test_mints_a_token_whose_claims_scope_the_room_and_identity():
    minted = LiveKitHandler().mint_room_token(
        CONFIG, room="interview-abc", identity="candidate-abc", grants=RoomGrants()
    )

    claims = _claims(minted.token)
    assert claims["sub"] == "candidate-abc"
    assert claims["video"]["room"] == "interview-abc"
    assert claims["video"]["roomJoin"] is True
    assert claims["video"]["canPublish"] is True
    assert claims["video"]["canSubscribe"] is True
    assert minted.ws_url == "wss://livekit.example"
    assert minted.expires_in == RoomGrants().ttl_seconds


def test_a_subscribe_only_grant_cannot_publish():
    minted = LiveKitHandler().mint_room_token(
        CONFIG,
        room="interview-abc",
        identity="observer-1",
        grants=RoomGrants(can_publish=False, hidden=True),
    )

    claims = _claims(minted.token)
    assert claims["video"].get("canPublish") in (False, None)
    assert claims["video"]["hidden"] is True


def test_agent_dispatch_travels_in_the_token():
    minted = LiveKitHandler().mint_room_token(
        CONFIG,
        room="interview-abc",
        identity="candidate-abc",
        grants=RoomGrants(agents=(AgentDispatch(name="interviewer", metadata='{"round":"1"}'),)),
    )

    dispatched = _claims(minted.token)["roomConfig"]["agents"]
    assert [a["agentName"] for a in dispatched] == ["interviewer"]
    assert dispatched[0]["metadata"] == '{"round":"1"}'


def test_ttl_drives_the_jwt_expiry_not_just_the_response_field():
    minted = LiveKitHandler().mint_room_token(
        CONFIG, room="r", identity="i", grants=RoomGrants(ttl_seconds=120)
    )

    # LiveKit stamps nbf, not iat -- and the frontend's TokenSourceCached re-fetches off
    # exp, so this claim is the real expiry the browser will act on.
    claims = _claims(minted.token)
    assert claims["exp"] - claims["nbf"] == 120
    assert minted.expires_in == 120


def test_missing_credentials_raise_rather_than_signing_with_an_empty_secret():
    with pytest.raises(ValueError, match="not configured"):
        LiveKitHandler().mint_room_token(
            {"host": "wss://livekit.example"}, room="r", identity="i", grants=RoomGrants()
        )


def test_livekit_resolves_as_both_a_credential_and_a_realtime_handler():
    assert isinstance(get_realtime_handler("livekit"), LiveKitHandler)
    assert isinstance(get_credential_handler("livekit"), LiveKitHandler)


def test_a_non_realtime_provider_is_rejected_by_the_realtime_accessor():
    with pytest.raises(ValueError, match="does not host realtime rooms"):
        get_realtime_handler("google_drive")
