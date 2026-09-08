"""Real end-to-end test: a real Temporal test server, real ImportInitiatorWorkflow and
SyncWorkflow, real activities -- proves _trigger_sync (called after a successful connect)
genuinely starts a sync for that connection, not just that it calls something that doesn't
crash. Only the provider adapter's HTTP calls and importer's own tps gRPC client are
stubbed, matching apps/importer/tests/test_sync_workflow_e2e.py's own convention.
"""

import asyncio

import pytest
from temporalio.testing import WorkflowEnvironment
from temporalio.worker import Worker

from apps.core.api.marketplace_views import _trigger_sync
from apps.importer.initiator.activities import create_sync_run_activity, select_connections_activity
from apps.importer.initiator.workflows import ImportInitiatorWorkflow
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
from apps.importer.sync.workflows import SyncWorkflow
from apps.tps.models import Connection, Connector


@pytest.fixture
async def temporal_env():
    env = await WorkflowEnvironment.start_local()
    yield env
    await env.shutdown()


@pytest.fixture(autouse=True)
def _stub_tps_client(monkeypatch):
    async def fake_get_token(project_id, connection_id):
        return "fake-access-token"

    monkeypatch.setattr("apps.importer.sync.activities._tps_get_token", fake_get_token)


@pytest.fixture
def stub_drive_page(monkeypatch):
    async def fake_list_page(self, access_token, cursor):
        return Page(
            items=[ItemRef(id="file-1", name="One", mime_type="text/plain", version="v1", size=5)],
            next_cursor=None,
        )

    async def fake_download_item(self, access_token, item):
        return DownloadedItem(item=item, payload=b"content", content_type="text/plain")

    monkeypatch.setattr(GoogleDriveProviderAdapter, "list_page", fake_list_page)
    monkeypatch.setattr(GoogleDriveProviderAdapter, "download_item", fake_download_item)


@pytest.mark.django_db(transaction=True)
async def test_connecting_an_app_triggers_an_immediate_sync(
    temporal_env, stub_drive_page, monkeypatch
):
    from apps.core.config import settings as core_settings

    monkeypatch.setattr(
        core_settings, "temporal_address", temporal_env.client.service_client.config.target_host
    )
    monkeypatch.setattr(core_settings, "importer_task_queue", "importer")

    # Not relying on the google_drive seed migration's row -- a transaction=True test
    # earlier in the suite can flush it away (Django doesn't restore migration-seeded
    # data between TransactionTestCase-style tests without serialized_rollback), so this
    # creates its own, self-contained, same pattern as apps/tps/tests/test_grpc_e2e.py.
    connector, _ = await Connector.objects.aget_or_create(
        app_name="google_drive",
        defaults={
            "app_code": 1,
            "display_name": "Google Drive",
            "auth_type": 1,
            "category": 5,
            "is_install_required": True,
            "active": True,
        },
    )
    connection = await Connection.objects.acreate(
        project_id="proj-connect",
        connector=connector,
        app_name="google_drive",
        config_encrypted="unused-in-this-test",
        status=Connection.Status.ACTIVE,
    )

    async with Worker(
        temporal_env.client,
        task_queue="importer",
        workflows=[ImportInitiatorWorkflow, SyncWorkflow],
        activities=[
            select_connections_activity,
            create_sync_run_activity,
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
        await _trigger_sync(connection.id)

        # _trigger_sync only starts the workflow -- poll for the observable side effect
        # rather than the initiator's own handle, matching the established convention for
        # every other fire-and-forget trigger in this codebase.
        run = None
        for _ in range(100):
            run = await SyncRun.objects.filter(connection_id=connection.id).afirst()
            if run is not None and run.status != SyncRun.Status.RUNNING:
                break
            await asyncio.sleep(0.1)

    assert run is not None
    assert run.status == SyncRun.Status.COMPLETED
    assert await RawDocument.objects.filter(connection_id=connection.id).aexists()
