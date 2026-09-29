"""What the interviewer does when it cannot speak.

The failure that matters is not a missing key -- that is handled before the session
starts. It is the one in between: a key that authenticates against an account that
cannot synthesise, which is what an exhausted Cartesia balance looks like.
"""

from interviewer import voice


class _Output:
    def __init__(self, enabled=True):
        self.audio_enabled = enabled

    def set_audio_enabled(self, value):
        self.audio_enabled = value


class _Session:
    def __init__(self, enabled=True):
        self.output = _Output(enabled)


class _Status(Exception):
    def __init__(self, status_code):
        self.status_code = status_code


def test_a_credit_exhausted_account_stops_the_interview_speaking():
    """402 on every utterance left an interviewer sitting in the room in silence, which
    reads as an agent that never joined rather than a provider that stopped working."""
    session = _Session()

    assert voice.is_permanent(_Status(402))
    voice.drop_to_text(session, "402")

    assert session.output.audio_enabled is False


def test_a_transient_failure_does_not_give_up_on_speaking():
    """A timeout or a 5xx is worth another utterance; a bad key is not."""
    assert not voice.is_permanent(_Status(503))
    assert not voice.is_permanent(_Status(None))
    assert not voice.is_permanent(Exception("no status at all"))
    assert voice.is_permanent(_Status(401))


def test_dropping_to_text_twice_is_harmless():
    """Every utterance raises, so this is called once per failure, not once per session."""
    session = _Session(enabled=False)
    voice.drop_to_text(session, "402")

    assert session.output.audio_enabled is False


def test_half_a_conversation_is_not_offered(monkeypatch):
    """Two providers: Deepgram hears, Cartesia speaks.

    Hearing without speaking listens in silence; speaking without hearing talks over the
    candidate. Either is worse than text both sides can read, so both keys or neither.
    """
    monkeypatch.setenv("DEEPGRAM_API_KEY", "k")
    monkeypatch.setenv("CARTESIA_API_KEY", "k")
    assert voice.available().voice

    monkeypatch.delenv("CARTESIA_API_KEY")
    modality = voice.available()
    assert not modality.voice
    assert "CARTESIA_API_KEY" in modality.describe()


async def test_all_speech_keys_dead_makes_the_call_text_only(monkeypatch):
    from interviewer import core_client, speech_keys

    reports = []

    async def fake_select(voice_id):
        key = speech_keys.SpeechKey(1, "sk_car_dead0000")
        return speech_keys.Selection([], [(key, speech_keys.Health.EXHAUSTED)])

    async def fake_report(key, problem, left):
        reports.append((key, problem, left))

    monkeypatch.setattr(speech_keys, "select", fake_select)
    monkeypatch.setattr(core_client, "report_speech_key", fake_report)

    modality, chain = await voice.prepare_speech(voice.Modality(can_hear=True, can_speak=True), "v")

    assert chain == [] and not modality.voice
    assert reports == [("CARTESIA_API_KEY (…0000)", "out of credits", 0)]


def test_several_keys_become_one_fallback_chain():
    from interviewer.speech_keys import SpeechKey
    from livekit.agents.tts import FallbackAdapter

    one = voice.speech_tts([SpeechKey(1, "a")], "v")
    many = voice.speech_tts([SpeechKey(1, "a"), SpeechKey(2, "b")], "v")

    assert not isinstance(one, FallbackAdapter)
    assert isinstance(many, FallbackAdapter)
