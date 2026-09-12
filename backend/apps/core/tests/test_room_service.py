"""room_service is the seam apps.interview composes. Two properties matter most: it
carries no feature vocabulary, and every upstream failure becomes one exception type the
caller can map to a status without leaking why.
"""

import pytest

from apps.core.clients import vas_client
from apps.core.services import room_service


@pytest.fixture
def fake_tps(monkeypatch):
    calls = []

    async def mint(**kwargs):
        calls.append(kwargs)
        return {"token": "jwt", "ws_url": "ws://livekit.test", "expires_in": kwargs["ttl_seconds"]}

    monkeypatch.setattr(room_service.tps_client, "mint_room_token", mint)
    return calls


async def test_mint_join_token_passes_the_room_identity_and_agents_through(fake_tps):
    result = await room_service.mint_join_token(
        "proj-1",
        "interview-abc",
        "candidate-abc",
        ttl_seconds=600,
        agents=(("interviewer", '{"round":"behavioral"}'),),
    )

    assert result == {"token": "jwt", "ws_url": "ws://livekit.test", "expires_in": 600}
    call = fake_tps[0]
    assert call["room"] == "interview-abc"
    assert call["identity"] == "candidate-abc"
    assert call["agents"] == (("interviewer", '{"round":"behavioral"}'),)
    assert call["app_name"] == room_service.REALTIME_APP_NAME


async def test_mint_join_token_defaults_to_publish_and_subscribe(fake_tps):
    await room_service.mint_join_token("proj-1", "interview-abc", "candidate-abc")

    call = fake_tps[0]
    assert (call["can_publish"], call["can_subscribe"], call["hidden"]) == (True, True, False)


async def test_a_tps_failure_becomes_room_unavailable_with_no_upstream_detail(monkeypatch):
    async def explode(**kwargs):
        raise RuntimeError("grpc: connection refused to localhost:50051")

    monkeypatch.setattr(room_service.tps_client, "mint_room_token", explode)

    with pytest.raises(room_service.RoomUnavailable) as exc_info:
        await room_service.mint_join_token("proj-1", "interview-abc", "candidate-abc")

    assert "grpc" not in str(exc_info.value)
    assert "50051" not in str(exc_info.value)


async def test_ensure_artifact_session_returns_the_vas_session_id(monkeypatch):
    seen = {}

    async def register(external_session_id, room_name, metadata, auto_record):
        seen["auto_record"] = auto_record
        return {"id": "vs-1", "external_session_id": external_session_id}

    monkeypatch.setattr(room_service.vas_client, "register_session", register)

    assert await room_service.ensure_artifact_session("iv-1", "interview-iv-1") == "vs-1"
    assert seen["auto_record"] is False


async def test_auto_record_is_forwarded_to_vas(monkeypatch):
    """A provider room does not exist until its first participant joins, so recording
    cannot be started when a token is minted -- it is asked for in advance instead."""
    seen = {}

    async def register(external_session_id, room_name, metadata, auto_record):
        seen["auto_record"] = auto_record
        return {"id": "vs-1"}

    monkeypatch.setattr(room_service.vas_client, "register_session", register)

    await room_service.ensure_artifact_session("iv-1", "interview-iv-1", None, auto_record=True)
    assert seen["auto_record"] is True


@pytest.mark.parametrize(
    "failure",
    [
        pytest.param(vas_client.VasUnavailable("Video service unavailable"), id="unreachable"),
        pytest.param(vas_client.VasError(400, "room_name is required"), id="refused"),
    ],
)
async def test_a_vas_failure_registering_becomes_room_unavailable(monkeypatch, failure):
    async def explode(external_session_id, room_name, metadata, auto_record):
        raise failure

    monkeypatch.setattr(room_service.vas_client, "register_session", explode)

    with pytest.raises(room_service.RoomUnavailable):
        await room_service.ensure_artifact_session("iv-1", "interview-iv-1")


async def test_recording_control_passes_straight_through_to_vas(monkeypatch):
    calls = []

    async def start(vas_session_id, layout, audio_only):
        calls.append(("start", vas_session_id, layout, audio_only))
        return {"id": "r1", "status": "starting"}

    async def stop(vas_session_id, recording_id):
        calls.append(("stop", vas_session_id, recording_id))
        return {"id": "r1", "status": "ending"}

    monkeypatch.setattr(room_service.vas_client, "start_recording", start)
    monkeypatch.setattr(room_service.vas_client, "stop_recording", stop)

    assert (await room_service.start_recording("vs-1"))["status"] == "starting"
    assert (await room_service.stop_recording("vs-1"))["status"] == "ending"
    assert calls == [("start", "vs-1", "speaker", False), ("stop", "vs-1", None)]


async def test_recording_errors_keep_their_status_for_the_caller_to_map(monkeypatch):
    """A 409 from vas has to survive as a 409: apps.interview turns it into one, and
    flattening it here would make "already recording" indistinguishable from a fault."""

    async def explode(vas_session_id, layout, audio_only):
        raise vas_client.VasError(409, "Recording EG_1 is already active")

    monkeypatch.setattr(room_service.vas_client, "start_recording", explode)

    with pytest.raises(vas_client.VasError) as exc_info:
        await room_service.start_recording("vs-1")
    assert exc_info.value.status == 409


def test_room_service_carries_no_interview_vocabulary():
    """The whole point of this module is that a second feature can use it. Asserted over
    identifiers rather than raw source, so the docstring is free to name apps.interview
    while explaining the boundary.
    """
    import ast
    import inspect

    tree = ast.parse(inspect.getsource(room_service))
    identifiers = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            identifiers.add(node.id)
        elif isinstance(node, ast.Attribute):
            identifiers.add(node.attr)
        elif isinstance(node, ast.arg):
            identifiers.add(node.arg)
        elif isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef | ast.ClassDef):
            identifiers.add(node.name)

    leaked = {
        name
        for name in identifiers
        for word in ("interview", "candidate", "consent", "round", "resume", "transcript")
        if word in name.lower()
    }
    assert not leaked, f"room_service leaked feature vocabulary: {sorted(leaked)}"
