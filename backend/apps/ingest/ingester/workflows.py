"""IngesterWorkflow -- one instance per RawDocument. Startable directly (e.g. for a one-off
reprocess) without going through IngestInitiatorWorkflow's discovery -- never import from
initiator/ here.
"""

from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from apps.ingest.ingester.activities import ingest_document_activity


@workflow.defn
class IngesterWorkflow:
    @workflow.run
    async def run(self, raw_document_id: str) -> None:
        await workflow.execute_activity(
            ingest_document_activity,
            raw_document_id,
            start_to_close_timeout=timedelta(minutes=5),
            retry_policy=RetryPolicy(maximum_attempts=3),
        )
