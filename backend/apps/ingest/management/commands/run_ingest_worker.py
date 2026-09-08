import asyncio
import contextlib
from datetime import timedelta

from django.core.management.base import BaseCommand
from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
    ScheduleIntervalSpec,
    ScheduleSpec,
)
from temporalio.worker import Worker

from apps.ingest.config import settings
from apps.ingest.ingester.activities import ingest_document_activity
from apps.ingest.ingester.workflows import IngesterWorkflow
from apps.ingest.initiator.activities import select_pending_raw_documents_activity
from apps.ingest.initiator.workflows import IngestInitiatorInput, IngestInitiatorWorkflow

SWEEP_SCHEDULE_ID = "ingest-sweep"


async def ensure_sweep_schedule(client: Client) -> None:
    async for scheduled in await client.list_schedules():
        if scheduled.id == SWEEP_SCHEDULE_ID:
            return
    # See apps.importer's identical ensure_sweep_schedule: list_schedules can lag a
    # just-created schedule, so a near-simultaneous caller can race to create it and land
    # here -- meaning it already exists, the outcome we wanted anyway.
    with contextlib.suppress(ScheduleAlreadyRunningError):
        await client.create_schedule(
            SWEEP_SCHEDULE_ID,
            Schedule(
                action=ScheduleActionStartWorkflow(
                    IngestInitiatorWorkflow.run,
                    IngestInitiatorInput(),
                    id="ingest-initiator-sweep",
                    task_queue=settings.temporal_task_queue,
                ),
                spec=ScheduleSpec(
                    intervals=[
                        ScheduleIntervalSpec(
                            every=timedelta(seconds=settings.sweep_interval_seconds)
                        )
                    ]
                ),
            ),
        )


class Command(BaseCommand):
    help = "Run the Temporal worker for apps.ingest's workflows and activities"

    def handle(self, *args, **options):
        asyncio.run(self._run())

    async def _run(self) -> None:
        client = await Client.connect(settings.temporal_address)
        await ensure_sweep_schedule(client)
        worker = Worker(
            client,
            task_queue=settings.temporal_task_queue,
            workflows=[IngestInitiatorWorkflow, IngesterWorkflow],
            activities=[select_pending_raw_documents_activity, ingest_document_activity],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"ingest worker running on task queue '{settings.temporal_task_queue}' "
                f"against {settings.temporal_address}"
            )
        )
        await worker.run()
