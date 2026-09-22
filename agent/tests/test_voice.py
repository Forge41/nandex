"""What the interviewer does when it cannot speak.

Both halves of the conversation run on one Deepgram key now. The failure that matters is
the one in between: a key that authenticates and an account that cannot synthesise.
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


def test_one_key_carries_both_halves(monkeypatch):
    """Deepgram does transcription and speech, so they stand or fall together."""
    monkeypatch.setenv("DEEPGRAM_API_KEY", "k")
    assert voice.available().voice

    monkeypatch.delenv("DEEPGRAM_API_KEY")
    modality = voice.available()
    assert not modality.voice
    assert "DEEPGRAM_API_KEY" in modality.describe()
