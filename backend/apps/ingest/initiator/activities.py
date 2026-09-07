from asgiref.sync import sync_to_async
from temporalio import activity

from apps.importer.models import RawDocument
from apps.ingest.config import settings
from apps.ingest.models import IngestRun


def _select_pending_sync() -> list[str]:
    completed_ids = IngestRun.objects.filter(
        pipeline_version=settings.pipeline_version, status=IngestRun.Status.COMPLETED
    ).values_list("raw_document_id", flat=True)
    pending = RawDocument.objects.exclude(id__in=completed_ids).order_by("fetched_at")
    return list(pending.values_list("id", flat=True)[: settings.sweep_batch_size])


@activity.defn
async def select_pending_raw_documents_activity() -> list[str]:
    return await sync_to_async(_select_pending_sync, thread_sensitive=True)()
