"""What the interviewer is told, before it says anything.

The instructions are the whole behaviour of this agent, so they are asserted here rather
than inferred from listening to a recording of it.
"""

from interviewer.briefing import coding_context, describe, greeting_instruction, instructions_for
from interviewer.core_client import Brief

PAYLOAD = {
    "sessionId": "s1",
    "candidateName": "Priya Raghunathan",
    "roleTitle": "Senior Backend Engineer — Payments",
    "activeStage": "resume",
    "planReady": True,
    "totalDurationMin": 94,
    "rounds": [
        {
            "id": "behavioral",
            "label": "Behavioral — ownership",
            "durationMin": 10,
            "summary": "Ownership scope and measurement rigor",
            "citation": 3,
        },
        {
            "id": "quiz",
            "label": "Knowledge check",
            "durationMin": 5,
            "summary": "",
            "citation": None,
        },
        {"id": "qa", "label": "Your questions", "durationMin": 8, "summary": "", "citation": None},
    ],
    "resume": {
        "candidate": {"name": "Priya Raghunathan", "title": "Senior Backend Engineer"},
        "probes": [
            {"title": "Latency measurement", "note": "How 40 percent was measured", "citation": 3}
        ],
        "citations": [{"id": 3, "quote": "cutting settlement latency by 40 percent"}],
    },
}


def brief(**overrides) -> Brief:
    return Brief.from_payload({**PAYLOAD, **overrides})


def test_each_substantial_round_carries_the_line_it_came_from():
    """The whole point of the plan screen: the interviewer can say why a round exists,
    in the candidate's own words."""
    text = describe(brief())

    assert "Behavioral — ownership (10 min)" in text
    assert 'they wrote "cutting settlement latency by 40 percent"' in text


def test_the_quote_is_verbatim_and_never_reconstructed():
    b = brief()
    assert b.quote_for(3) == "cutting settlement latency by 40 percent"
    # A citation the resume did not produce yields nothing rather than a guess.
    assert b.quote_for(99) == ""
    assert b.quote_for(None) == ""


def test_short_rounds_are_summarised_rather_than_read_out():
    """Two five-minute rounds named aloud cost more speech than they convey."""
    text = describe(brief())

    assert "2 shorter rounds, about 13 minutes together" in text
    assert "do not read them out one by one" in text


def test_a_round_with_no_summary_is_still_named():
    text = describe(
        brief(
            rounds=[
                {
                    "id": "design",
                    "label": "System design canvas",
                    "durationMin": 15,
                    "summary": "",
                    "citation": None,
                }
            ]
        )
    )
    assert "System design canvas (15 min)" in text


def test_an_unnamed_candidate_is_not_given_an_invented_name():
    text = describe(
        brief(candidateName="", resume={"candidate": {}, "probes": [], "citations": []})
    )
    assert "do not guess" in text


def test_the_greeting_is_an_instruction_not_a_script():
    """A fixed line would be the same sentence for every candidate, which is the opposite
    of a plan built from their own resume."""
    said = greeting_instruction(brief())

    assert "Priya Raghunathan" in said
    assert "Start interview" in said


def test_the_instructions_carry_the_prompt_file_and_the_plan():
    text = instructions_for(brief())

    # From the prompt file, not from any f-string here.
    assert "You are being heard, not read" in text
    assert "Behavioral — ownership" in text


def test_missing_speech_keys_leave_a_working_interviewer(monkeypatch):
    """A missing API key must not become an interviewer who never arrives: the candidate
    cannot tell that apart from a broken product."""
    from interviewer import voice

    monkeypatch.delenv("DEEPGRAM_API_KEY", raising=False)
    monkeypatch.delenv("CARTESIA_API_KEY", raising=False)
    modality = voice.available()

    assert modality.voice is False
    assert "DEEPGRAM_API_KEY and CARTESIA_API_KEY" in modality.describe()

    room_input, room_output = voice.room_options(modality)
    # Still heard from, in writing: the transcript panel renders these.
    assert room_output.transcription_enabled is True
    assert room_output.audio_enabled is False
    # And still answerable, because the panel has a box to type in.
    assert room_input.text_enabled is True


def test_one_speech_key_is_not_half_a_conversation(monkeypatch):
    """Hearing without speaking listens in silence; speaking without hearing talks over
    the candidate. Either is worse than text both sides can read."""
    from interviewer import voice

    monkeypatch.setenv("DEEPGRAM_API_KEY", "set")
    monkeypatch.delenv("CARTESIA_API_KEY", raising=False)

    assert voice.available().voice is False


def test_both_keys_give_a_spoken_interview(monkeypatch):
    from interviewer import voice

    monkeypatch.setenv("DEEPGRAM_API_KEY", "set")
    monkeypatch.setenv("CARTESIA_API_KEY", "set")
    modality = voice.available()

    assert modality.voice is True
    assert modality.describe() == "voice"
    room_input, room_output = voice.room_options(modality)
    assert room_input.audio_enabled is True
    assert room_output.audio_enabled is True


def test_only_unsent_turns_are_sent_again():
    """A flush that failed must leave its turns queued, not drop them -- the transcript is
    the record a human reviews."""
    from interviewer.transcript import TranscriptRecorder

    class Item:
        def __init__(self, role, text):
            self.role, self.text_content = role, text

    recorder = TranscriptRecorder("s1")
    recorder.add(Item("assistant", "Hello Priya."))
    recorder.add(Item("user", "Hi."))

    assert len(recorder.pending()) == 2
    # Core accepted only the first.
    recorder.mark_flushed(1)
    assert [t["text"] for t in recorder.pending()] == ["Hi."]

    recorder.add(Item("assistant", "Shall we start?"))
    assert [t["text"] for t in recorder.pending()] == ["Hi.", "Shall we start?"]


def test_only_the_conversation_is_recorded():
    """System instructions and tool calls are not turns: the transcript is shown to the
    candidate and read by a human, and should be what was actually said."""
    from interviewer.transcript import TranscriptRecorder

    class Item:
        def __init__(self, role, text):
            self.role, self.text_content = role, text

    recorder = TranscriptRecorder("s1")
    recorder.add(Item("system", "You are the interviewer"))
    recorder.add(Item("assistant", "   "))
    recorder.add(Item("user", "Real words."))

    assert [(t["speaker"], t["text"]) for t in recorder.turns()] == [("candidate", "Real words.")]


def test_a_turn_is_timed_from_when_it_started_not_when_it_ended():
    """Items arrive complete, so timing them on arrival puts a minute-long answer at the
    moment it finished -- a transcript a human reads should say when someone began."""
    import time

    from interviewer.transcript import TranscriptRecorder

    class Item:
        def __init__(self, role, text, created_at):
            self.role, self.text_content, self.created_at = role, text, created_at

    joined = time.time()
    recorder = TranscriptRecorder("s1", started_wall=joined)
    # Began two seconds in; handed over a minute later, when it finished.
    recorder.add(Item("assistant", "A long greeting.", joined + 2))

    assert recorder.turns()[0]["atSeconds"] == 2


def test_an_item_with_no_timestamp_still_lands_on_the_timeline():
    from interviewer.transcript import TranscriptRecorder

    class Item:
        def __init__(self):
            self.role, self.text_content, self.created_at = "user", "Hello.", None

    assert TranscriptRecorder("s1").add(Item()) is None


def _coding_brief(coding):
    return Brief(
        session_id="s1",
        candidate_name="Priya",
        role_title="Senior Backend Engineer",
        active_stage="coding",
        plan_ready=True,
        total_duration_min=94,
        coding=coding,
    )


def test_the_interviewer_is_told_it_cannot_see_the_code():
    """The point of having an interviewer in this round is asking about the failing case,
    not reading along."""
    context = coding_context(
        _coding_brief(
            {
                "taskNumber": 1,
                "taskTotal": 2,
                "title": "Retry-safe applier",
                "brief": ["Apply events idempotently."],
                "language": "python",
                "hasRun": True,
                "phase": "ran",
                "passed": 2,
                "total": 4,
                "failing": ["out_of_order_replay", "window_boundary"],
                "attemptsUsed": 1,
                "attemptsAllowed": 3,
            }
        )
    )

    assert "passed 2 of 4" in context
    assert "out_of_order_replay, window_boundary" in context
    assert "cannot see their code" in context


def test_nothing_is_claimed_about_a_run_that_has_not_happened():
    context = coding_context(
        _coding_brief({"taskNumber": 1, "taskTotal": 2, "title": "T", "brief": [], "hasRun": False})
    )

    assert "not run their tests yet" in context
    assert "passed" not in context


def test_a_compile_failure_is_not_reported_as_failing_tests():
    context = coding_context(
        _coding_brief(
            {
                "taskNumber": 1,
                "taskTotal": 1,
                "title": "T",
                "brief": [],
                "hasRun": True,
                "phase": "compile_failed",
                "attemptsUsed": 0,
                "attemptsAllowed": 3,
            }
        )
    )

    assert "did not compile" in context
    assert "no attempt was used" in context


def test_a_crash_leaves_unrun_cases_unknown_rather_than_failed():
    context = coding_context(
        _coding_brief(
            {
                "taskNumber": 1,
                "taskTotal": 1,
                "title": "T",
                "brief": [],
                "hasRun": True,
                "phase": "crashed",
                "attemptsUsed": 1,
                "attemptsAllowed": 3,
            }
        )
    )

    assert "unknown, not failures" in context


def test_a_candidate_outside_the_coding_round_gets_no_coding_context():
    assert coding_context(_coding_brief(None)) == ""
