from asgiref.sync import sync_to_async
from temporalio import activity

from apps.ingest.pipeline.run import IngestAlreadyInFlightError, ingest_raw_document


def _run_sync(raw_document_id: str) -> str:
    try:
        run = ingest_raw_document(raw_document_id)
        return run.status
    except IngestAlreadyInFlightError:
        # Another run already owns this document (e.g. a manual ingest_document CLI call
        # racing IngestInitiatorWorkflow's own backfill) -- an expected outcome, not
        # something Temporal should retry.
        return "already_in_flight"


@activity.defn
async def ingest_document_activity(raw_document_id: str) -> str:
    return await sync_to_async(_run_sync, thread_sensitive=True)(raw_document_id)
