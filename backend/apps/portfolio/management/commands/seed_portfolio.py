from django.core.management.base import BaseCommand, CommandError

from apps.importer.uploads import store_versioned_document_sync
from apps.ingest.models import IngestRun
from apps.ingest.pipeline.run import IngestAlreadyInFlightError, ingest_raw_document
from apps.portfolio.config import settings
from apps.portfolio.corpus import load_corpus


class Command(BaseCommand):
    help = (
        "Store every portfolio source as a RawDocument and index it. Idempotent: an "
        "unchanged source is neither stored nor indexed again. Ingests synchronously, "
        "like ingest_document, because production runs no Temporal worker."
    )

    def handle(self, *args, **options):
        sources = load_corpus(settings.corpus_dir)
        if not sources:
            raise CommandError(f"No sources in {settings.corpus_dir}")

        stored = indexed = failed = 0
        for source in sources:
            document, created = store_versioned_document_sync(
                project_id=settings.project_id,
                provider_document_id=source.provider_document_id,
                provider_version=source.version,
                content_type="text/markdown",
                payload=source.payload,
                display_name=source.display_name,
            )
            stored += created
            try:
                run = ingest_raw_document(document.id)
            except IngestAlreadyInFlightError:
                continue
            if run.status == IngestRun.Status.COMPLETED:
                indexed += 1
            else:
                failed += 1
                self.stderr.write(f"{source.id}: failed at {run.failed_stage}: {run.error_message}")

        self.stdout.write(
            f"sources={len(sources)} new_versions={stored} indexed={indexed} failed={failed}"
        )
        if failed:
            raise CommandError(f"{failed} source(s) failed to index")
