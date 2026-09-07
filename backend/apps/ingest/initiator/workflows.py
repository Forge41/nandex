"""IngestInitiatorWorkflow -- decides what needs ingesting and fans out one IngesterWorkflow
per RawDocument. Contains no parsing/chunking/embedding logic; see ingester/workflows.py for
that. Never imported by ingester/ -- an IngesterWorkflow must be startable directly.
"""

from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from apps.ingest.ingester.workflows import IngesterWorkflow
    from apps.ingest.initiator.activities import select_pending_raw_documents_activity


@dataclass
class IngestInitiatorInput:
    pass  # no runtime parameters yet -- batch size comes from settings, read inside the activity


@workflow.defn
class IngestInitiatorWorkflow:
    @workflow.run
    async def run(self, input: IngestInitiatorInput) -> None:
        pending_ids = await workflow.execute_activity(
            select_pending_raw_documents_activity,
            start_to_close_timeout=timedelta(seconds=30),
        )
        for raw_document_id in pending_ids:
            # Default parent_close_policy is TERMINATE -- without ABANDON, this workflow
            # returning (it never awaits its children) would kill every child mid-flight.
            await workflow.start_child_workflow(
                IngesterWorkflow.run,
                raw_document_id,
                id=f"ingest-{raw_document_id}",
                parent_close_policy=workflow.ParentClosePolicy.ABANDON,
            )
