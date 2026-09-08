import asyncio

from django.core.management.base import BaseCommand
from temporalio.client import Client
from temporalio.worker import Worker

from apps.ingest.config import settings
from apps.ingest.ingester.activities import ingest_document_activity
from apps.ingest.ingester.workflows import IngesterWorkflow
from apps.ingest.initiator.activities import select_pending_raw_documents_activity
from apps.ingest.initiator.workflows import IngestInitiatorWorkflow


class Command(BaseCommand):
    help = "Run the Temporal worker for apps.ingest's workflows and activities"

    def handle(self, *args, **options):
        asyncio.run(self._run())

    async def _run(self) -> None:
        client = await Client.connect(settings.temporal_address)
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
