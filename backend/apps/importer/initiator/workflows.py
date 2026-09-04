"""ImportInitiatorWorkflow — decides what needs syncing and fans out one SyncWorkflow
per Connection. Contains no provider-specific fetch/download logic; see sync/workflows.py
for that. Never imported by sync/ — a SyncWorkflow must be startable directly (e.g. to
retry one connection) without going through discovery here.
"""

from dataclasses import dataclass
from datetime import timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from apps.importer.initiator.activities import (
        create_sync_run_activity,
        select_connections_activity,
    )
    from apps.importer.models import SyncRun
    from apps.importer.sync.workflows import SyncWorkflow, SyncWorkflowInput


@dataclass
class ImportInitiatorInput:
    connection_id: str | None = None  # manual: sync exactly this one
    # str, not apps.tps.catalog.IntegrationSlug: crosses Temporal's workflow serialization
    # boundary via select_connections_activity -- see sync/activities.py's _get_adapter.
    app_name: str | None = None  # scheduled: every active Connection for this app
    trigger: SyncRun.Trigger = SyncRun.Trigger.MANUAL


@workflow.defn
class ImportInitiatorWorkflow:
    @workflow.run
    async def run(self, input: ImportInitiatorInput) -> None:
        targets = await workflow.execute_activity(
            select_connections_activity,
            args=[input.connection_id, input.app_name],
            start_to_close_timeout=timedelta(seconds=30),
        )

        for target in targets:
            sync_run_id = await workflow.execute_activity(
                create_sync_run_activity,
                args=[target["connection_id"], input.trigger],
                start_to_close_timeout=timedelta(seconds=30),
            )
            await workflow.start_child_workflow(
                SyncWorkflow.run,
                SyncWorkflowInput(
                    connection_id=target["connection_id"],
                    project_id=target["project_id"],
                    app_name=target["app_name"],
                    sync_run_id=sync_run_id,
                ),
                id=f"import-sync-{target['connection_id']}",
            )
