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

    class PlanState(models.TextChoices):
        IDLE = "idle", "idle"
        PROCESSING = "processing", "processing"
        READY = "ready", "ready"
        FAILED = "failed", "failed"

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

    # Whether the resume has been turned into a plan. Only the terminal answer lives
    # here; the step-by-step account belongs to the workflow, which can be queried for
    # it, and duplicating that in a column would give two versions of the same story.
    # This one has to be durable because Temporal drops history on its own schedule and
    # "is this interview ready" must outlive that.
    plan_state = models.CharField(max_length=16, choices=PlanState.choices, default=PlanState.IDLE)
    plan_error = models.TextField(blank=True, default="")

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

    class ContentState(models.TextChoices):
        PENDING = "pending", "pending"
        GENERATING = "generating", "generating"
        READY = "ready", "ready"
        FAILED = "failed", "failed"

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
    # Whether that payload has been generated yet. Distinct from the round's relation to
    # progress, which stays derived: a round can be next in line and still be waiting for
    # its task, and the button that starts it needs to know which.
    content_state = models.CharField(
        max_length=16, choices=ContentState.choices, default=ContentState.PENDING
    )

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


class CodeDraft(models.Model):
    """The editor buffer, saved as the candidate types.

    Keyed by language as well as task: switching to Java and back must return the Python
    buffer exactly as it was left, and the two are different answers to the same task.

    Which of these may be sent to the runner is decided by the stored task, not by this
    row -- see services.runner_payload. A draft whose name is not an editable file of the
    task is refused before it is written, because a draft named after the test file would
    otherwise let a candidate grade themselves.
    """

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session = models.ForeignKey(
        InterviewSession, on_delete=models.CASCADE, related_name="drafts", db_index=True
    )
    stage_id = models.CharField(max_length=32)
    task_index = models.IntegerField(default=0)
    language = models.CharField(max_length=16)
    file_name = models.CharField(max_length=255)
    content = models.TextField(blank=True, default="")
    # Candidate data, so it answers to the same deletion request their recording does.
    retain_until = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "interview_code_draft"
        constraints = (
            models.UniqueConstraint(
                fields=["session", "stage_id", "task_index", "language", "file_name"],
                name="uniq_draft_per_file",
            ),
        )

    def __str__(self) -> str:
        return f"{self.session_id}:{self.stage_id}:{self.language}:{self.file_name}"


class CodeRun(models.Model):
    """One attempt: what was submitted, and what really happened to it.

    The record of what the candidate did. `attemptsUsed` and the attempts meter are
    derived from these rows rather than stored anywhere, so there is one answer to how
    many attempts were taken.

    The row is created *before* the run starts, inside a locked transaction, so the
    attempt limit is decided against committed rows. Writing it at the end would let N
    simultaneous requests all read zero used attempts and all pass.
    """

    class Phase(models.TextChoices):
        # Created, not yet finished. A row in this state still counts against the limit.
        RUNNING = "running", "running"
        RAN = "ran", "ran"
        # Nothing ran because nothing built. Deliberately not an attempt -- see
        # counts_as_attempt.
        COMPILE_FAILED = "compile_failed", "compile_failed"
        CRASHED = "crashed", "crashed"
        TIMEOUT = "timeout", "timeout"
        UNAVAILABLE = "unavailable", "unavailable"

    id = models.CharField(primary_key=True, max_length=24, default=generate_id, editable=False)
    session = models.ForeignKey(
        InterviewSession, on_delete=models.CASCADE, related_name="code_runs", db_index=True
    )
    stage_id = models.CharField(max_length=32)
    task_index = models.IntegerField(default=0)
    language = models.CharField(max_length=16)
    attempt = models.IntegerField()
    # Exactly what was sent to the sandbox, candidate files and task files together.
    files = models.JSONField(default=dict, blank=True)
    phase = models.CharField(max_length=16, choices=Phase.choices, default=Phase.RUNNING)
    # Per-case results as the runner reported them. A case that never ran is absent
    # rather than failed.
    tests = models.JSONField(default=list, blank=True)
    terminal = models.JSONField(default=list, blank=True)
    exit_code = models.IntegerField(null=True, blank=True)
    duration_ms = models.IntegerField(default=0)
    truncated = models.BooleanField(default=False)
    timed_out = models.BooleanField(default=False)
    retain_until = models.DateTimeField(null=True, blank=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "interview_code_run"
        ordering = ("created_at",)

    def __str__(self) -> str:
        return f"{self.session_id}:{self.stage_id}#{self.attempt}:{self.phase}"

    @property
    def counts_as_attempt(self) -> bool:
        """A run that never produced a binary does not cost the candidate an attempt.

        Otherwise `attemptsAllowed: 3` means three real tries in Python and possibly one
        in C++, where a missing semicolon is a scored attempt. The same applies when the
        runner itself was unreachable: that is our failure, not theirs.
        """
        return self.phase not in (
            self.Phase.COMPILE_FAILED,
            self.Phase.UNAVAILABLE,
        )

    @property
    def outcome(self) -> str:
        """pass, partial or fail over every case, hidden ones included.

        The whole truth, for whoever reviews this interview. What the candidate is shown
        is `outcome_over(visible_tests(...))`, which is deliberately not the same thing.
        """
        return self.outcome_over(self.tests)

    def outcome_over(self, tests: list[dict]) -> str:
        """`partial` is the ordinary result once runs are real, and the reason the
        attempts meter needs a third colour."""
        reported = [t for t in tests if t.get("outcome")]
        if not reported:
            return "fail"
        passed = sum(1 for t in reported if t["outcome"] == "pass")
        if passed == len(reported):
            return "pass"
        return "fail" if passed == 0 else "partial"

    def visible_tests(self, hidden_names: set[str]) -> list[dict]:
        return [t for t in self.tests if t.get("name") not in hidden_names]
