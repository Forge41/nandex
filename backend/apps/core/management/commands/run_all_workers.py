"""One process, every task queue this deployment runs.

Anywhere that bills per always-on process, four workers is four bills for work that
fits in one interpreter. The queues stay distinct -- each Worker keeps its own name
and its own registrations -- so splitting them apart again is a deployment change,
not a code change.

apps.vas_* is deliberately absent. It is a leaf that nothing above it may import, and
recording is off in this deployment anyway (INTERVIEW_RECORDING_ENABLED), so its queue
has no work. `run_vas_worker` still exists for a deployment that turns recording on.
"""

import asyncio

from config import temporal
from django.core.management.base import BaseCommand
from temporalio.worker import Worker

from apps.importer.config import settings as importer_settings
from apps.importer.initiator.activities import create_sync_run_activity, select_connections_activity
from apps.importer.initiator.workflows import ImportInitiatorWorkflow
from apps.importer.sync.activities import (
    advance_cursor_activity,
    download_batch_activity,
    finish_run_activity,
    get_token_activity,
    list_page_activity,
    mark_reauth_required_activity,
    skip_unchanged_activity,
    write_raw_documents_activity,
)
from apps.importer.sync.workflows import SyncWorkflow
from apps.ingest.config import settings as ingest_settings
from apps.ingest.ingester.activities import ingest_document_activity
from apps.ingest.ingester.workflows import IngesterWorkflow
from apps.ingest.initiator.activities import select_pending_raw_documents_activity
from apps.ingest.initiator.workflows import IngestInitiatorWorkflow
from apps.interview.activities import (
    end_session_activity,
    generate_plan_activity,
    generate_round_content_activity,
    parse_resume_activity,
    rounds_needing_content_activity,
    set_plan_state_activity,
)
from apps.interview.config import settings as interview_settings
from apps.interview.workflows import InterviewSessionWorkflow


class Command(BaseCommand):
    help = (
        "Run one Temporal worker per task queue -- importer, ingest, interview -- in this process"
    )

    def handle(self, *args, **options):
        asyncio.run(self._run())

    async def _run(self) -> None:
        # All three apps point at the same Temporal by default. Connecting once and
        # sharing the client is not an optimisation here -- a second connection to the
        # same namespace is just a second thing to lose.
        client = await temporal.connect(interview_settings.temporal_address)

        workers = [
            Worker(
                client,
                task_queue=importer_settings.temporal_task_queue,
                workflows=[ImportInitiatorWorkflow, SyncWorkflow],
                activities=[
                    select_connections_activity,
                    create_sync_run_activity,
                    get_token_activity,
                    mark_reauth_required_activity,
                    list_page_activity,
                    skip_unchanged_activity,
                    download_batch_activity,
                    write_raw_documents_activity,
                    advance_cursor_activity,
                    finish_run_activity,
                ],
            ),
            Worker(
                client,
                task_queue=ingest_settings.temporal_task_queue,
                workflows=[IngestInitiatorWorkflow, IngesterWorkflow],
                activities=[select_pending_raw_documents_activity, ingest_document_activity],
            ),
            Worker(
                client,
                task_queue=interview_settings.temporal_task_queue,
                workflows=[InterviewSessionWorkflow],
                activities=[
                    end_session_activity,
                    parse_resume_activity,
                    generate_plan_activity,
                    generate_round_content_activity,
                    rounds_needing_content_activity,
                    set_plan_state_activity,
                ],
            ),
        ]

        queues = ", ".join(w.task_queue for w in workers)
        self.stdout.write(
            self.style.SUCCESS(
                f"workers running on task queues {queues} "
                f"against {interview_settings.temporal_address}"
            )
        )

        # gather, not a sequence of awaits: one worker losing its connection must take
        # the process down rather than leaving the others silently serving a subset of
        # the queues. A half-working worker is harder to notice than a dead one.
        await asyncio.gather(*(w.run() for w in workers))
