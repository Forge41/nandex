from django.core.management.base import BaseCommand, CommandError

from apps.ingest.pipeline.run import IngestAlreadyInFlightError, ingest_raw_document


class Command(BaseCommand):
    help = "Run the ingest pipeline for one RawDocument synchronously."

    def add_arguments(self, parser):
        parser.add_argument("raw_document_id")

    def handle(self, *args, **options):
        raw_document_id = options["raw_document_id"]
        try:
            run = ingest_raw_document(raw_document_id)
        except IngestAlreadyInFlightError as e:
            raise CommandError(str(e)) from e

        self.stdout.write(f"status={run.status} failed_stage={run.failed_stage or '-'}")
        if run.error_message:
            self.stdout.write(f"error={run.error_message}")
