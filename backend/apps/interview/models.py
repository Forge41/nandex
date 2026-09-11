"""Interview sessions, their rounds, and what was recorded of them.

Cross-app references (project_id, user_id, resume_document_id, vas_session_id) are plain
indexed CharFields rather than ForeignKeys, the convention throughout this codebase. For
vas_session_id that is not merely convention: vas shares this database but is a separate
deployable behind an HTTP boundary, and an ORM relation would weld the two together.
"""

import secrets

from django.db import models


def generate_id() -> str:
    return secrets.token_hex(12)


def room_name_for(session_id: str) -> str:
    """The provider room name for a session. One function so the agent worker, the token
    endpoint and vas registration cannot drift on the format -- the worker parses the
    session id back out of it."""
    return f"interview-{session_id}"


def candidate_identity_for(session_id: str) -> str:
    """The participant identity a candidate joins as. Derived server-side and never taken
    from a request body: the browser must not be able to mint a token as the interviewer
    or as another candidate."""
    return f"candidate-{session_id}"


class InterviewSession(models.Model):
    class Status(models.TextChoices):
        CREATED = "created", "created"
        ACTIVE = "active", "active"
        ENDED = "ended", "ended"

    class RecordingState(models.TextChoices):
        OFF = "off", "off"
        # Consented and registered with the video service, which starts recording the
        # moment the room exists. A room does not exist until its first participant
        # joins, so this is as far as the session can get before the candidate connects.
        ARMED = "armed", "armed"
        RECORDING = "recording", "recording"
        # A recording that failed must never block the interview, so this is a state the
        # session carries rather than an error the candidate sees.
        FAILED = "failed", "failed"
        STOPPED = "stopped", "stopped"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    project_id = models.CharField(db_index=True, max_length=24)
    user_id = models.CharField(db_index=True, max_length=24)
    candidate_name = models.CharField(max_length=255, blank=True, default="")
    role_title = models.CharField(max_length=255)
    total_duration_min = models.IntegerField(default=0)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CREATED)
    recording_state = models.CharField(
        max_length=16, choices=RecordingState.choices, default=RecordingState.OFF
    )

    consent_recording = models.BooleanField(default=False)
    consent_ai_interviewer = models.BooleanField(default=False)
    consent_integrity_monitoring = models.BooleanField(default=False)

    active_stage = models.CharField(max_length=32, default="preflight")
    # Index into the ordered rounds of the furthest round unlocked. Rounds after it are
    # locked; rounds before it are complete.
    progress_index = models.IntegerField(default=0)

    room_name = models.CharField(unique=True, max_length=255)
    vas_session_id = models.CharField(db_index=True, max_length=24, blank=True, default="")
    resume_document_id = models.CharField(db_index=True, max_length=24, blank=True, default="")

    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "interview_session"

    def __str__(self) -> str:
        return f"{self.id}:{self.status}"


class InterviewRound(models.Model):
    """One round of an interview. Replaces the frontend's DEFAULT_ROUNDS, which is now
    only a fallback shape.

    status is deliberately absent: a round's relation to progress is derived from the
    session's progress_index, so storing it too would give two answers that can disagree.
    """

    class Kind(models.TextChoices):
        SETUP = "setup", "setup"
        CONVERSATION = "conversation", "conversation"
        TASK = "task", "task"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session = models.ForeignKey(
        InterviewSession, on_delete=models.CASCADE, related_name="rounds", db_index=True
    )
    stage_id = models.CharField(max_length=32)
    label = models.CharField(max_length=255)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    duration_min = models.IntegerField(default=0)
    order = models.IntegerField()
    # The resume citation this round was generated from, when it came from one.
    citation = models.IntegerField(null=True, blank=True)
    summary = models.TextField(blank=True, default="")
    # The round's task payload, shaped by stage_id (a CodingTask, a SqlTask, ...). Empty
    # until something generates it; the UI already renders a missing-content state, which
    # is honest where inventing a task would not be.
    content = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = "interview_round"
        ordering = ("order",)
        constraints = (
            models.UniqueConstraint(fields=["session", "stage_id"], name="uniq_round_per_stage"),
        )

    def __str__(self) -> str:
        return f"{self.session_id}:{self.stage_id}"


class ResumeFacts(models.Model):
    """What the interviewer read out of the candidate's resume.

    The resume itself stays in importer's immutable RawDocument; this is the derived
    reading of it, which is regenerable and therefore safe to overwrite.
    """

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session = models.OneToOneField(
        InterviewSession, on_delete=models.CASCADE, related_name="resume_facts"
    )
    file_name = models.CharField(max_length=512)
    size_bytes = models.BigIntegerField(default=0)
    # Null until the document is actually parsed. Asserting a count next to a visibly
    # different document is worse than showing none.
    page_count = models.IntegerField(null=True, blank=True)
    entity_count = models.IntegerField(default=0)

    candidate_name = models.CharField(max_length=255, blank=True, default="")
    candidate_title = models.CharField(max_length=255, blank=True, default="")
    candidate_location = models.CharField(max_length=255, blank=True, default="")
    candidate_email = models.CharField(max_length=320, blank=True, default="")
    candidate_years_experience = models.IntegerField(null=True, blank=True)

    # Shapes match ResumeSection[], Probe[] and Citation[] in
    # frontend/lib/interview/types.ts. Kept as JSON because the frontend renders them
    # whole and nothing queries inside them.
    sections = models.JSONField(default=list, blank=True)
    probes = models.JSONField(default=list, blank=True)
    citations = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "interview_resume_facts"

    def __str__(self) -> str:
        return f"{self.session_id}:{self.file_name}"


class TranscriptTurn(models.Model):
    """One turn of the conversation.

    Written by the agent worker, which is the only party that sees final speech-to-text
    with timings. The browser is not a trustworthy persistence path for a record the UI
    promises is saved with the session.
    """

    class Speaker(models.TextChoices):
        INTERVIEWER = "interviewer", "interviewer"
        CANDIDATE = "candidate", "candidate"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session = models.ForeignKey(
        InterviewSession, on_delete=models.CASCADE, related_name="transcript", db_index=True
    )
    speaker = models.CharField(max_length=16, choices=Speaker.choices)
    text = models.TextField()
    # Seconds since the session started, so a turn's timestamp agrees with the timer the
    # candidate sees rather than with wall-clock.
    at_seconds = models.IntegerField(default=0)
    assessments = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "interview_transcript_turn"
        ordering = ("at_seconds", "created_at")

    def __str__(self) -> str:
        return f"{self.session_id}:{self.speaker}@{self.at_seconds}"


class SessionRecording(models.Model):
    """What vas recorded, as reported by its callback.

    The unique constraint is the callback's idempotency mechanism: vas retries, so the
    same completion arriving three times must leave one row.

    gcs_object_key is stored, never a signed URL -- those expire in hours and are fetched
    on demand through core.
    """

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session = models.ForeignKey(
        InterviewSession, on_delete=models.CASCADE, related_name="recordings", db_index=True
    )
    vas_recording_id = models.CharField(max_length=24)
    egress_id = models.CharField(max_length=255, blank=True, default="")
    status = models.CharField(max_length=16, blank=True, default="")
    gcs_bucket = models.CharField(max_length=255, blank=True, default="")
    gcs_object_key = models.CharField(max_length=1024, blank=True, default="")
    duration_seconds = models.FloatField(null=True, blank=True)
    file_size_bytes = models.BigIntegerField(null=True, blank=True)
    checksum = models.CharField(max_length=128, blank=True, default="")
    failure_reason = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "interview_session_recording"
        constraints = (
            models.UniqueConstraint(
                fields=["session", "vas_recording_id"], name="uniq_recording_per_session"
            ),
        )

    def __str__(self) -> str:
        return f"{self.session_id}:{self.vas_recording_id}"
