import asyncio
from datetime import timedelta

from django.core.management.base import BaseCommand
from temporalio.client import (
    Client,
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleIntervalSpec,
    ScheduleSpec,
)
from temporalio.worker import Worker

from apps.importer.config import settings
from apps.importer.initiator.activities import create_sync_run_activity, select_connections_activity
from apps.importer.initiator.workflows import ImportInitiatorInput, ImportInitiatorWorkflow
from apps.importer.models import SyncRun
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

SWEEP_SCHEDULE_ID = "import-sweep"


async def ensure_sweep_schedule(client: Client) -> None:
    """A brand-new Connection is picked up here, not by anything notifying this
    workflow directly -- see initiator/activities.py's docstring for why."""
    async for scheduled in await client.list_schedules():
        if scheduled.id == SWEEP_SCHEDULE_ID:
            return
    await client.create_schedule(
        SWEEP_SCHEDULE_ID,
        Schedule(
            action=ScheduleActionStartWorkflow(
                ImportInitiatorWorkflow.run,
                ImportInitiatorInput(trigger=SyncRun.Trigger.SCHEDULED),
                id="import-initiator-sweep",
                task_queue=settings.temporal_task_queue,
            ),
            spec=ScheduleSpec(
                intervals=[
                    ScheduleIntervalSpec(every=timedelta(seconds=settings.sweep_interval_seconds))
                ]
            ),
        ),
    )


class Command(BaseCommand):
    help = "Run the Temporal worker for apps.importer's workflows and activities"

    def handle(self, *args, **options):
        asyncio.run(self._run())

    async def _run(self) -> None:
        client = await Client.connect(settings.temporal_address)
        await ensure_sweep_schedule(client)
        worker = Worker(
            client,
            task_queue=settings.temporal_task_queue,
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
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"importer worker running on task queue '{settings.temporal_task_queue}' "
                f"against {settings.temporal_address}"
            )
        )
        await worker.run()
