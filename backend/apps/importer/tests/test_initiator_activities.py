import pytest

from apps.importer.initiator.activities import create_sync_run_activity, select_connections_activity
from apps.importer.models import SyncRun
from apps.tps.models import AppCategory, AuthType, Connection, Connector


@pytest.fixture
async def connector():
    # transaction=True flushes tables (including migration-seeded data) after every
    # test, so the 0002 seed row can't be relied on to still be there -- get_or_create
    # rather than colliding on app_code's uniqueness constraint with a second insert.
    connector, _ = await Connector.objects.aget_or_create(
        app_name="google_drive",
        defaults={
            "app_code": 1,
            "display_name": "Google Drive",
            "auth_type": AuthType.OAUTH2,
            "category": AppCategory.STORAGE,
            "active": True,
        },
    )
    return connector


@pytest.mark.django_db(transaction=True)
async def test_select_connections_by_app_name_returns_only_active(connector):
    await Connection.objects.acreate(
        project_id="proj-1", connector=connector, app_name="google_drive", config_encrypted="x"
    )
    revoked = await Connection.objects.acreate(
        project_id="proj-2", connector=connector, app_name="google_drive", config_encrypted="x"
    )
    revoked.status = Connection.Status.REVOKED
    await revoked.asave(update_fields=["status"])

    targets = await select_connections_activity(None, "google_drive")

    assert len(targets) == 1
    assert targets[0]["project_id"] == "proj-1"
    assert targets[0]["app_name"] == "google_drive"


@pytest.mark.django_db(transaction=True)
async def test_select_connections_by_connection_id_ignores_app_name(connector):
    conn = await Connection.objects.acreate(
        project_id="proj-1", connector=connector, app_name="google_drive", config_encrypted="x"
    )

    targets = await select_connections_activity(conn.id, None)

    assert [t["connection_id"] for t in targets] == [conn.id]


@pytest.mark.django_db(transaction=True)
async def test_create_sync_run_activity_persists_trigger():
    sync_run_id = await create_sync_run_activity("conn-1", SyncRun.Trigger.SCHEDULED)

    run = await SyncRun.objects.aget(id=sync_run_id)
    assert run.connection_id == "conn-1"
    assert run.trigger == SyncRun.Trigger.SCHEDULED
    assert run.status == SyncRun.Status.RUNNING
