from django.core.management.base import BaseCommand

from apps.importer.models import RawDocument
from apps.ingest.config import settings
from apps.ingest.models import IngestRun
from apps.ingest.pipeline.run import IngestAlreadyInFlightError, ingest_raw_document


class Command(BaseCommand):
    help = (
        "Manual one-shot sweep: run the ingest pipeline for every RawDocument with no "
        "COMPLETED IngestRun at the current pipeline_version. Not a scheduler."
    )

    def add_arguments(self, parser):
        parser.add_argument("--limit", type=int, default=None)

    def handle(self, *args, **options):
        completed_ids = IngestRun.objects.filter(
            pipeline_version=settings.pipeline_version, status=IngestRun.Status.COMPLETED
        ).values_list("raw_document_id", flat=True)
        pending = RawDocument.objects.exclude(id__in=completed_ids).order_by("fetched_at")
        if options["limit"]:
            pending = pending[: options["limit"]]

        completed = failed = skipped = 0
        for raw_document in pending:
            try:
                run = ingest_raw_document(raw_document.id)
            except IngestAlreadyInFlightError:
                skipped += 1
                continue
            if run.status == IngestRun.Status.COMPLETED:
                completed += 1
            else:
                failed += 1
                self.stdout.write(
                    f"{raw_document.id}: failed at {run.failed_stage}: {run.error_message}"
                )

        self.stdout.write(f"completed={completed} failed={failed} skipped={skipped}")
