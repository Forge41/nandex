"""Real end-to-end test: an actual Temporal test server (temporalio.testing.WorkflowEnvironment),
a real Worker, the real IngestInitiatorWorkflow/IngesterWorkflow and their real activities --
only the embedding model is stubbed (fake_embedder), matching apps/importer's e2e test convention.
"""

import asyncio
import uuid

import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from apps.importer.models import RawDocument
from apps.ingest.ingester.activities import ingest_document_activity
from apps.ingest.ingester.workflows import IngesterWorkflow
from apps.ingest.initiator.activities import select_pending_raw_documents_activity
from apps.ingest.initiator.workflows import IngestInitiatorInput, IngestInitiatorWorkflow
from apps.ingest.models import IngestRun, ProcessedChunk


@pytest.fixture
async def temporal_env():
    env = await WorkflowEnvironment.start_local()
    yield env
    await env.shutdown()


@pytest.fixture
def task_queue():
    return f"test-queue-{uuid.uuid4().hex[:8]}"


async def _wait_for_ingest_run(raw_document_id: str, *, timeout: float = 10.0) -> IngestRun:
    """The initiator's start_child_workflow calls are fire-and-forget (it returns once each
    child is scheduled, not once it completes) -- poll for the observable side effect
    instead of relying on child-workflow-handle completion timing."""
    deadline = asyncio.get_event_loop().time() + timeout
    while asyncio.get_event_loop().time() < deadline:
        run = await IngestRun.objects.filter(raw_document_id=raw_document_id).afirst()
        if run is not None and run.status != IngestRun.Status.RUNNING:
            return run
        await asyncio.sleep(0.1)
    raise AssertionError(f"IngestRun for {raw_document_id} never completed within {timeout}s")


@pytest.mark.django_db(transaction=True)
async def test_sweep_ingests_every_pending_raw_document(temporal_env, task_queue, fake_embedder):
    doc_a = await RawDocument.objects.acreate(
        connection_id="conn-test",
        provider_document_id="doc-a",
        payload=b"Ada Lovelace wrote the first published algorithm.",
        content_type="text/plain",
    )
    doc_b = await RawDocument.objects.acreate(
        connection_id="conn-test",
        provider_document_id="doc-b",
        payload=b"The mitochondria is the powerhouse of the cell.",
        content_type="text/plain",
    )

    async with Worker(
        temporal_env.client,
        task_queue=task_queue,
        workflows=[IngestInitiatorWorkflow, IngesterWorkflow],
        activities=[select_pending_raw_documents_activity, ingest_document_activity],
    ):
        await temporal_env.client.execute_workflow(
            IngestInitiatorWorkflow.run,
            IngestInitiatorInput(),
            id="ingest-initiator-test",
            task_queue=task_queue,
        )
        runs = [await _wait_for_ingest_run(doc.id) for doc in (doc_a, doc_b)]

    for doc, run in zip((doc_a, doc_b), runs, strict=True):
        assert run.status == IngestRun.Status.COMPLETED
        assert await ProcessedChunk.objects.filter(raw_document_id=doc.id).aexists()


@pytest.mark.django_db(transaction=True)
async def test_sweep_excludes_already_completed_documents(temporal_env, task_queue, fake_embedder):
    doc = await RawDocument.objects.acreate(
        connection_id="conn-test",
        provider_document_id="doc-completed",
        payload=b"already done",
        content_type="text/plain",
    )
    await IngestRun.objects.acreate(
        raw_document_id=doc.id, pipeline_version=1, status=IngestRun.Status.COMPLETED
    )

    async with Worker(
        temporal_env.client,
        task_queue=task_queue,
        workflows=[IngestInitiatorWorkflow, IngesterWorkflow],
        activities=[select_pending_raw_documents_activity, ingest_document_activity],
    ):
        await temporal_env.client.execute_workflow(
            IngestInitiatorWorkflow.run,
            IngestInitiatorInput(),
            id="ingest-initiator-test-2",
            task_queue=task_queue,
        )

    assert await IngestRun.objects.filter(raw_document_id=doc.id).acount() == 1
    assert not await ProcessedChunk.objects.filter(raw_document_id=doc.id).aexists()
