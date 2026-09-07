"""Real end-to-end test: an actual Temporal test server (temporalio.testing.WorkflowEnvironment),
a real Worker, the real SyncWorkflow and its real activities — only the provider adapter's
HTTP calls and the tps gRPC client are stubbed, since there's no live Google/tps server here.
"""

import uuid

import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from apps.importer.models import RawDocument, SyncRun
from apps.importer.providers.base import DownloadedItem, ItemRef, Page
from apps.importer.providers.google_drive import GoogleDriveProviderAdapter
from apps.importer.sync.activities import (
    advance_cursor_activity,
    download_batch_activity,
    finish_run_activity,
    get_token_activity,
    list_page_activity,
    mark_reauth_required_activity,
    skip_unchanged_activity,
    write_raw_documents_activity,
)
from apps.importer.sync.workflows import SyncWorkflow, SyncWorkflowInput


@pytest.fixture
async def temporal_env():
    env = await WorkflowEnvironment.start_local()
    yield env
    await env.shutdown()


@pytest.fixture
def task_queue():
    return f"test-queue-{uuid.uuid4().hex[:8]}"


@pytest.fixture(autouse=True)
def _stub_tps_client(monkeypatch):
    async def fake_get_token(project_id, connection_id):
        return "fake-access-token"

    monkeypatch.setattr("apps.importer.sync.activities._tps_get_token", fake_get_token)


@pytest.fixture
def stub_drive_pages(monkeypatch):
    """Two pages of one item each — exercises the cursor/pagination loop, not just a
    single-page happy path."""
    pages = [
        Page(
            items=[ItemRef(id="file-1", name="One", mime_type="text/plain", version="v1", size=5)],
            next_cursor="page-2",
        ),
        Page(
            items=[ItemRef(id="file-2", name="Two", mime_type="text/plain", version="v1", size=5)],
            next_cursor=None,
        ),
    ]
    calls = {"n": 0}

    async def fake_list_page(self, access_token, cursor):
        page = pages[calls["n"]]
        calls["n"] += 1
        return page

    async def fake_download_item(self, access_token, item):
        return DownloadedItem(
            item=item, payload=f"content-of-{item.id}".encode(), content_type="text/plain"
        )

    monkeypatch.setattr(GoogleDriveProviderAdapter, "list_page", fake_list_page)
    monkeypatch.setattr(GoogleDriveProviderAdapter, "download_item", fake_download_item)
    return pages


@pytest.mark.django_db(transaction=True)
async def test_sync_workflow_downloads_both_pages_end_to_end(
    temporal_env, task_queue, stub_drive_pages
):
    sync_run = await SyncRun.objects.acreate(
        connection_id="conn-e2e", trigger=SyncRun.Trigger.MANUAL
    )

    async with Worker(
        temporal_env.client,
        task_queue=task_queue,
        workflows=[SyncWorkflow],
        activities=[
            get_token_activity,
            mark_reauth_required_activity,
            list_page_activity,
            skip_unchanged_activity,
            download_batch_activity,
            write_raw_documents_activity,
            advance_cursor_activity,
            finish_run_activity,
        ],
    ):
        await temporal_env.client.execute_workflow(
            SyncWorkflow.run,
            SyncWorkflowInput(
                connection_id="conn-e2e",
                project_id="proj-e2e",
                app_name="google_drive",
                sync_run_id=sync_run.id,
            ),
            id=f"sync-e2e-{uuid.uuid4().hex[:8]}",
            task_queue=task_queue,
        )

    docs = [
        d
        async for d in RawDocument.objects.filter(connection_id="conn-e2e").order_by(
            "provider_document_id"
        )
    ]
    assert [d.provider_document_id for d in docs] == ["file-1", "file-2"]
    assert docs[0].payload == b"content-of-file-1"

    await sync_run.arefresh_from_db()
    assert sync_run.status == SyncRun.Status.COMPLETED
    assert sync_run.items_written == 2
    assert sync_run.items_failed == 0
    assert sync_run.cursor == ""  # last page's next_cursor was None


@pytest.mark.django_db(transaction=True)
async def test_sync_workflow_skips_unchanged_items_on_rerun(temporal_env, task_queue, monkeypatch):
    """Second run of the same connection, same file/version -- should skip the download
    entirely (skip_unchanged_activity), not re-fetch and re-write it."""
    item = ItemRef(id="file-1", name="One", mime_type="text/plain", version="v1", size=5)
    download_calls = {"n": 0}

    async def fake_list_page(self, access_token, cursor):
        return Page(items=[item], next_cursor=None)

    async def fake_download_item(self, access_token, item):
        download_calls["n"] += 1
        return DownloadedItem(item=item, payload=b"content", content_type="text/plain")

    monkeypatch.setattr(GoogleDriveProviderAdapter, "list_page", fake_list_page)
    monkeypatch.setattr(GoogleDriveProviderAdapter, "download_item", fake_download_item)

    await RawDocument.objects.acreate(
        connection_id="conn-rerun",
        provider_document_id="file-1",
        provider_version="v1",
        payload=b"already-have-this",
        content_type="text/plain",
    )
    sync_run = await SyncRun.objects.acreate(
        connection_id="conn-rerun", trigger=SyncRun.Trigger.SCHEDULED
    )

    async with Worker(
        temporal_env.client,
        task_queue=task_queue,
        workflows=[SyncWorkflow],
        activities=[
            get_token_activity,
            mark_reauth_required_activity,
            list_page_activity,
            skip_unchanged_activity,
            download_batch_activity,
            write_raw_documents_activity,
            advance_cursor_activity,
            finish_run_activity,
        ],
    ):
        await temporal_env.client.execute_workflow(
            SyncWorkflow.run,
            SyncWorkflowInput(
                connection_id="conn-rerun",
                project_id="proj-rerun",
                app_name="google_drive",
                sync_run_id=sync_run.id,
            ),
            id=f"sync-rerun-{uuid.uuid4().hex[:8]}",
            task_queue=task_queue,
        )

    assert download_calls["n"] == 0  # never downloaded -- skip_unchanged_activity dropped it
    doc = await RawDocument.objects.aget(connection_id="conn-rerun")
    assert doc.payload == b"already-have-this"  # untouched


@pytest.mark.django_db(transaction=True)
async def test_sync_workflow_continues_as_new_across_executions(
    temporal_env, task_queue, monkeypatch
):
    """continue_as_new_page_threshold=1 forces a continue-as-new after every single page --
    with 3 pages, that's 2 handoffs to a fresh workflow execution before completion. If
    the cursor/counters weren't actually carried forward correctly, this would either
    lose items or loop forever instead of ending COMPLETED with all 3 written.
    """
    pages = [
        Page(
            items=[
                ItemRef(id=f"file-{i}", name=str(i), mime_type="text/plain", version="v1", size=5)
            ],
            next_cursor=(f"page-{i + 1}" if i < 3 else None),
        )
        for i in range(1, 4)
    ]
    calls = {"n": 0}

    async def fake_list_page(self, access_token, cursor):
        page = pages[calls["n"]]
        calls["n"] += 1
        return page

    async def fake_download_item(self, access_token, item):
        return DownloadedItem(item=item, payload=b"x", content_type="text/plain")

    monkeypatch.setattr(GoogleDriveProviderAdapter, "list_page", fake_list_page)
    monkeypatch.setattr(GoogleDriveProviderAdapter, "download_item", fake_download_item)

    sync_run = await SyncRun.objects.acreate(
        connection_id="conn-can", trigger=SyncRun.Trigger.MANUAL
    )

    async with Worker(
        temporal_env.client,
        task_queue=task_queue,
        workflows=[SyncWorkflow],
        activities=[
            get_token_activity,
            mark_reauth_required_activity,
            list_page_activity,
            skip_unchanged_activity,
            download_batch_activity,
            write_raw_documents_activity,
            advance_cursor_activity,
            finish_run_activity,
        ],
    ):
        await temporal_env.client.execute_workflow(
            SyncWorkflow.run,
            SyncWorkflowInput(
                connection_id="conn-can",
                project_id="proj-can",
                app_name="google_drive",
                sync_run_id=sync_run.id,
                continue_as_new_page_threshold=1,
            ),
            id=f"sync-can-{uuid.uuid4().hex[:8]}",
            task_queue=task_queue,
        )

    docs = [
        d
        async for d in RawDocument.objects.filter(connection_id="conn-can").order_by(
            "provider_document_id"
        )
    ]
    assert [d.provider_document_id for d in docs] == ["file-1", "file-2", "file-3"]

    await sync_run.arefresh_from_db()
    assert sync_run.status == SyncRun.Status.COMPLETED
    assert sync_run.items_written == 3


@pytest.mark.django_db(transaction=True)
async def test_sync_workflow_stops_at_run_level_quota(temporal_env, task_queue, monkeypatch):
    """max_items_per_run=1 with 2 pages of 1 item each -- the run must stop after the
    first item, marked QUOTA_EXCEEDED, and never even list the second page.
    """
    pages_listed = {"n": 0}

    async def fake_list_page(self, access_token, cursor):
        pages_listed["n"] += 1
        i = pages_listed["n"]
        return Page(
            items=[
                ItemRef(id=f"file-{i}", name=str(i), mime_type="text/plain", version="v1", size=5)
            ],
            next_cursor=f"page-{i + 1}",
        )

    async def fake_download_item(self, access_token, item):
        return DownloadedItem(item=item, payload=b"x", content_type="text/plain")

    monkeypatch.setattr(GoogleDriveProviderAdapter, "list_page", fake_list_page)
    monkeypatch.setattr(GoogleDriveProviderAdapter, "download_item", fake_download_item)

    sync_run = await SyncRun.objects.acreate(
        connection_id="conn-quota", trigger=SyncRun.Trigger.MANUAL
    )

    async with Worker(
        temporal_env.client,
        task_queue=task_queue,
        workflows=[SyncWorkflow],
        activities=[
            get_token_activity,
            mark_reauth_required_activity,
            list_page_activity,
            skip_unchanged_activity,
            download_batch_activity,
            write_raw_documents_activity,
            advance_cursor_activity,
            finish_run_activity,
        ],
    ):
        await temporal_env.client.execute_workflow(
            SyncWorkflow.run,
            SyncWorkflowInput(
                connection_id="conn-quota",
                project_id="proj-quota",
                app_name="google_drive",
                sync_run_id=sync_run.id,
                max_items_per_run=1,
            ),
            id=f"sync-quota-{uuid.uuid4().hex[:8]}",
            task_queue=task_queue,
        )

    assert pages_listed["n"] == 1  # never reached page 2
    await sync_run.arefresh_from_db()
    assert sync_run.status == SyncRun.Status.QUOTA_EXCEEDED
    assert sync_run.items_written == 1


@pytest.mark.django_db(transaction=True)
async def test_sync_workflow_marks_run_errored_on_permanent_listing_failure(
    temporal_env, task_queue, monkeypatch
):
    """A PermanentProviderError from list_page is non-retryable at the Temporal layer
    (see PROVIDER_RETRY_POLICY) -- the run should end ERRORED quickly, not hang retrying
    something that will never succeed.
    """
    from apps.importer.errors import PermanentProviderError

    async def fake_list_page(self, access_token, cursor):
        raise PermanentProviderError("account not found")

    monkeypatch.setattr(GoogleDriveProviderAdapter, "list_page", fake_list_page)

    sync_run = await SyncRun.objects.acreate(
        connection_id="conn-err", trigger=SyncRun.Trigger.MANUAL
    )

    async with Worker(
        temporal_env.client,
        task_queue=task_queue,
        workflows=[SyncWorkflow],
        activities=[
            get_token_activity,
            mark_reauth_required_activity,
            list_page_activity,
            skip_unchanged_activity,
            download_batch_activity,
            write_raw_documents_activity,
            advance_cursor_activity,
            finish_run_activity,
        ],
    ):
        await temporal_env.client.execute_workflow(
            SyncWorkflow.run,
            SyncWorkflowInput(
                connection_id="conn-err",
                project_id="proj-err",
                app_name="google_drive",
                sync_run_id=sync_run.id,
            ),
            id=f"sync-err-{uuid.uuid4().hex[:8]}",
            task_queue=task_queue,
        )

    await sync_run.arefresh_from_db()
    assert sync_run.status == SyncRun.Status.ERRORED
