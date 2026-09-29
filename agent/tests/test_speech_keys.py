"""Five Cartesia accounts, used in order, so one running out of free credit moves the call
to the next rather than silencing it."""

import pytest
from interviewer import speech_keys
from interviewer.speech_keys import Health, SpeechKey


@pytest.fixture(autouse=True)
def fresh():
    speech_keys.reset()
    yield
    speech_keys.reset()


def _keys(n=5):
    return [SpeechKey(i, f"sk_car_key{i}xyz{i}") for i in range(1, n + 1)]


def _probing(monkeypatch, answers):
    probed = []

    async def fake(key, voice_id):
        probed.append(key.layer)
        return answers[key.layer]

    monkeypatch.setattr(speech_keys, "probe", fake)
    return probed


def test_keys_are_read_in_layer_order(monkeypatch):
    for layer in range(1, 6):
        monkeypatch.delenv(speech_keys.env_name(layer), raising=False)
    monkeypatch.setenv("CARTESIA_API_KEY_3", "three")
    monkeypatch.setenv("CARTESIA_API_KEY", "one")
    monkeypatch.setenv("CARTESIA_API_KEY_5", " ")

    assert [(k.layer, k.value) for k in speech_keys.configured()] == [(1, "one"), (3, "three")]


@pytest.mark.parametrize(
    ("status", "health"),
    [
        (200, Health.OK),
        (402, Health.EXHAUSTED),
        (401, Health.REJECTED),
        (403, Health.REJECTED),
        (503, Health.UNKNOWN),
        (None, Health.UNKNOWN),
    ],
)
def test_statuses(status, health):
    assert speech_keys.classify(status) is health


async def test_a_healthy_first_layer_is_the_only_probe(monkeypatch):
    probed = _probing(monkeypatch, {1: Health.OK})

    selection = await speech_keys.select("v", _keys())

    assert probed == [1]
    assert [k.layer for k in selection.chain] == [1, 2, 3, 4, 5]
    assert selection.newly_dead == []


async def test_exhausted_layers_are_skipped_and_reported(monkeypatch):
    probed = _probing(monkeypatch, {1: Health.EXHAUSTED, 2: Health.REJECTED, 3: Health.OK})

    selection = await speech_keys.select("v", _keys())

    assert probed == [1, 2, 3]
    assert [k.layer for k in selection.chain] == [3, 4, 5]
    assert [(k.layer, h) for k, h in selection.newly_dead] == [
        (1, Health.EXHAUSTED),
        (2, Health.REJECTED),
    ]


async def test_a_dead_key_is_reported_once_and_not_reprobed(monkeypatch):
    probed = _probing(monkeypatch, {1: Health.EXHAUSTED, 2: Health.OK})
    await speech_keys.select("v", _keys(2))

    probed.clear()
    again = await speech_keys.select("v", _keys(2))

    assert probed == []
    assert [k.layer for k in again.chain] == [2]
    assert again.newly_dead == []


async def test_an_unreachable_key_stays_in_the_chain(monkeypatch):
    _probing(monkeypatch, {1: Health.UNKNOWN, 2: Health.OK})

    selection = await speech_keys.select("v", _keys(3))

    assert [k.layer for k in selection.chain] == [1, 2, 3]


async def test_every_layer_dead_leaves_nothing_to_speak_with(monkeypatch):
    _probing(monkeypatch, dict.fromkeys(range(1, 6), Health.EXHAUSTED))

    selection = await speech_keys.select("v", _keys())

    assert selection.chain == []
    assert len(selection.newly_dead) == 5


def test_the_hint_never_carries_the_key():
    key = SpeechKey(2, "sk_car_secretvalue1234")
    assert key.hint == "CARTESIA_API_KEY_2 (…1234)"
    assert "secretvalue" not in key.hint
