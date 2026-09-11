import asyncio

from django.core.management.base import BaseCommand
from temporalio.client import Client
from temporalio.worker import Worker

from apps.vas_recordings.activities import (
    delete_recording_object,
    finish_artifact_deletion,
    list_deletable_recordings,
    post_recording_to_main_backend,
    verify_recording_object_exists,
)
from apps.vas_recordings.config import settings
from apps.vas_recordings.workflows import (
    ArtifactDeletionWorkflow,
    NotifyMainBackendWorkflow,
)


class Command(BaseCommand):
    help = "Run the Temporal worker for the vas_* apps' workflows and activities"

    def handle(self, *args, **options):
        asyncio.run(self._run())

    async def _run(self) -> None:
        client = await Client.connect(settings.temporal_address)
        worker = Worker(
            client,
            task_queue=settings.temporal_task_queue,
            workflows=[NotifyMainBackendWorkflow, ArtifactDeletionWorkflow],
            activities=[
                verify_recording_object_exists,
                post_recording_to_main_backend,
                list_deletable_recordings,
                delete_recording_object,
                finish_artifact_deletion,
            ],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"vas worker running on task queue '{settings.temporal_task_queue}' "
                f"against {settings.temporal_address}"
            )
        )
        await worker.run()
