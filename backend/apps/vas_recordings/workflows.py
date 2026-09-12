"""vas's Temporal workflows, plus the fire-and-forget triggers callers use.

Notifying the main backend and deleting a session's objects both re-hit external APIs
and must survive a restart part-way through, which is what AGENTS.md reserves Temporal
for. Starting one must never fail the request that triggered it: a recording that
completed but whose callback didn't fire is recoverable, a 500 to the provider's webhook
just makes it retry.
"""

import logging
from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow
from temporalio.client import Client
from temporalio.common import RetryPolicy

# The activities reach httpx and the ORM, which the workflow sandbox forbids importing.
# Same pattern as apps.ingest.ingester.workflows; importing them inside run() is not
# enough, because the sandbox re-walks the whole import graph.
with workflow.unsafe.imports_passed_through():
    from apps.vas_recordings.activities import (
        delete_recording_object,
        finish_artifact_deletion,
        list_deletable_recordings,
        post_recording_to_main_backend,
        verify_recording_object_exists,
    )
    from apps.vas_recordings.config import settings

logger = logging.getLogger(__name__)


@dataclass
class NotifyMainBackendInput:
    recording_id: str


@dataclass
class ArtifactDeletionInput:
    session_id: str
    deletion_id: str


@workflow.defn
class NotifyMainBackendWorkflow:
    @workflow.run
    async def run(self, payload: NotifyMainBackendInput) -> None:
        # Egress reports the job ended before the upload has necessarily landed, so this
        # polls rather than assuming presence -- the retries *are* the wait.
        await workflow.execute_activity(
            verify_recording_object_exists,
            payload.recording_id,
            start_to_close_timeout=timedelta(minutes=2),
            retry_policy=RetryPolicy(maximum_attempts=12, initial_interval=timedelta(seconds=5)),
        )
        await workflow.execute_activity(
            post_recording_to_main_backend,
            payload.recording_id,
            start_to_close_timeout=timedelta(seconds=30),
            retry_policy=RetryPolicy(
                maximum_attempts=10,
                initial_interval=timedelta(seconds=10),
                maximum_interval=timedelta(minutes=5),
            ),
        )


@workflow.defn
class ArtifactDeletionWorkflow:
    @workflow.run
    async def run(self, payload: ArtifactDeletionInput) -> None:
        recordings = await workflow.execute_activity(
            list_deletable_recordings,
            payload.session_id,
            start_to_close_timeout=timedelta(seconds=30),
        )
        for recording_id in recordings:
            await workflow.execute_activity(
                delete_recording_object,
                recording_id,
                start_to_close_timeout=timedelta(minutes=2),
                retry_policy=RetryPolicy(maximum_attempts=5),
            )
        await workflow.execute_activity(
            finish_artifact_deletion,
            payload.deletion_id,
            start_to_close_timeout=timedelta(seconds=30),
        )


async def _start(workflow_name: str, payload, workflow_id: str) -> None:
    try:
        client = await Client.connect(settings.temporal_address)
        await client.start_workflow(
            workflow_name,
            payload,
            id=workflow_id,
            task_queue=settings.temporal_task_queue,
        )
    except Exception:
        logger.warning("Couldn't start %s (%s)", workflow_name, workflow_id, exc_info=True)


async def trigger_notify_main_backend(recording_id: str) -> None:
    # A deterministic id, so a retried webhook for the same recording doesn't start a
    # second notification.
    await _start(
        "NotifyMainBackendWorkflow",
        NotifyMainBackendInput(recording_id=recording_id),
        f"vas-notify-{recording_id}",
    )


async def trigger_artifact_deletion(session_id: str, deletion_id: str) -> None:
    await _start(
        "ArtifactDeletionWorkflow",
        ArtifactDeletionInput(session_id=session_id, deletion_id=deletion_id),
        f"vas-delete-{deletion_id}",
    )
