import asyncio

from config import temporal
from django.core.management.base import BaseCommand
from temporalio.worker import Worker

from apps.interview.activities import (
    end_session_activity,
    generate_plan_activity,
    generate_round_content_activity,
    parse_resume_activity,
    rounds_needing_content_activity,
    set_plan_state_activity,
)
from apps.interview.config import settings
from apps.interview.workflows import InterviewSessionWorkflow


class Command(BaseCommand):
    help = "Run the Temporal worker for apps.interview's workflows and activities"

    def handle(self, *args, **options):
        asyncio.run(self._run())

    async def _run(self) -> None:
        client = await temporal.connect(settings.temporal_address)
        worker = Worker(
            client,
            task_queue=settings.temporal_task_queue,
            workflows=[InterviewSessionWorkflow],
            activities=[
                end_session_activity,
                parse_resume_activity,
                generate_plan_activity,
                generate_round_content_activity,
                rounds_needing_content_activity,
                set_plan_state_activity,
            ],
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"interview worker running on task queue '{settings.temporal_task_queue}' "
                f"against {settings.temporal_address}"
            )
        )
        await worker.run()
