from asgiref.sync import sync_to_async
from temporalio import activity

from apps.importer.models import SyncRun
from apps.tps.models import Connection


def _select_connections_sync(connection_id: str | None, app_name: str | None) -> list[dict]:
    qs = Connection.objects.filter(status=Connection.Status.ACTIVE)
    if connection_id:
        qs = qs.filter(id=connection_id)
    if app_name:
        qs = qs.filter(app_name=app_name)
    return [{"connection_id": c.id, "project_id": c.project_id, "app_name": c.app_name} for c in qs]


@activity.defn
async def select_connections_activity(
    connection_id: str | None, app_name: str | None
) -> list[dict]:
    """A specific connection_id is what apps.core's _trigger_sync passes for a just-connected
    app (see marketplace_views.py); an app_name syncs every active Connection for that app;
    neither syncs every active Connection regardless of app -- a manually-startable full
    backfill, not run on any automatic schedule.
    """
    return await sync_to_async(_select_connections_sync, thread_sensitive=True)(
        connection_id, app_name
    )


def _create_sync_run_sync(connection_id: str, trigger: SyncRun.Trigger) -> str:
    run = SyncRun.objects.create(connection_id=connection_id, trigger=trigger)
    return run.id


@activity.defn
async def create_sync_run_activity(connection_id: str, trigger: SyncRun.Trigger) -> str:
    return await sync_to_async(_create_sync_run_sync, thread_sensitive=True)(connection_id, trigger)
