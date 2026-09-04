"""SyncWorkflow — one per Connection, one per sync attempt (possibly split across
several Temporal workflow executions via continue_as_new). See the importer LLD and its
Google Drive companion doc for the full design and why each piece is shaped this way.
"""

from dataclasses import dataclass, replace
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy
from temporalio.exceptions import ActivityError

with workflow.unsafe.imports_passed_through():
    from apps.importer.models import SyncRun
    from apps.importer.providers.base import ItemRef
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

BATCH_SIZE = 20

PROVIDER_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=1),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=30),
    maximum_attempts=10,
    non_retryable_error_types=["PermanentProviderError"],
)

DOWNLOAD_RETRY_POLICY = RetryPolicy(
    initial_interval=timedelta(seconds=2),
    backoff_coefficient=2.0,
    maximum_interval=timedelta(seconds=60),
    maximum_attempts=8,
)


def _chunk(items: list, size: int):
    for i in range(0, len(items), size):
        yield items[i : i + size]


@dataclass
class SyncWorkflowInput:
    connection_id: str
    project_id: str
    # str, not apps.tps.catalog.IntegrationSlug, deliberately: this dataclass crosses
    # Temporal's workflow serialization boundary, and IntegrationSlug is a dynamically
    # created enum (enum.Enum(...) as a call, not a class statement) that Temporal's data
    # converter cannot correctly reconstruct there -- see sync/activities.py's _get_adapter.
    app_name: str
    sync_run_id: str
    cursor: str | None = None
    pages_this_execution: int = 0
    total_items_written: int = 0
    total_bytes_written: int = 0
    # Configurable rather than module constants, deliberately -- lets a specific
    # Connection's run be tuned (or a test exercise continue_as_new/quota) without a
    # code change. See the Google Drive pipeline doc for the production defaults.
    continue_as_new_page_threshold: int = 50
    max_items_per_run: int = 50_000
    max_bytes_per_run: int = 20 * 1024**3  # 20GB


@workflow.defn
class SyncWorkflow:
    @workflow.run
    async def run(self, input: SyncWorkflowInput) -> None:
        try:
            access_token = await workflow.execute_activity(
                get_token_activity,
                args=[input.project_id, input.connection_id],
                start_to_close_timeout=timedelta(seconds=30),
                retry_policy=RetryPolicy(maximum_attempts=3),
            )
        except ActivityError:
            await workflow.execute_activity(
                mark_reauth_required_activity,
                args=[input.project_id, input.connection_id],
                start_to_close_timeout=timedelta(seconds=30),
            )
            await self._finish(input.sync_run_id, SyncRun.Status.ERRORED)
            return

        cursor = input.cursor
        pages_this_execution = input.pages_this_execution
        total_items = input.total_items_written
        total_bytes = input.total_bytes_written

        while True:
            try:
                page = await workflow.execute_activity(
                    list_page_activity,
                    args=[input.app_name, access_token, cursor],
                    start_to_close_timeout=timedelta(seconds=60),
                    retry_policy=PROVIDER_RETRY_POLICY,
                )
            except ActivityError:
                await self._finish(input.sync_run_id, SyncRun.Status.ERRORED)
                return

            to_download: list[ItemRef] = await workflow.execute_activity(
                skip_unchanged_activity,
                args=[input.connection_id, page.items],
                start_to_close_timeout=timedelta(seconds=30),
            )

            for batch in _chunk(to_download, BATCH_SIZE):
                try:
                    results = await workflow.execute_activity(
                        download_batch_activity,
                        args=[input.app_name, access_token, batch],
                        start_to_close_timeout=timedelta(minutes=5),
                        retry_policy=DOWNLOAD_RETRY_POLICY,
                    )
                except ActivityError:
                    await self._finish(input.sync_run_id, SyncRun.Status.ERRORED)
                    return

                items_written, _items_failed, bytes_written = await workflow.execute_activity(
                    write_raw_documents_activity,
                    args=[input.connection_id, input.sync_run_id, results],
                    start_to_close_timeout=timedelta(seconds=30),
                )
                await workflow.execute_activity(
                    advance_cursor_activity,
                    args=[input.sync_run_id, page.next_cursor],
                    start_to_close_timeout=timedelta(seconds=30),
                )

                total_items += items_written
                total_bytes += bytes_written
                if total_items >= input.max_items_per_run or total_bytes >= input.max_bytes_per_run:
                    await self._finish(input.sync_run_id, SyncRun.Status.QUOTA_EXCEEDED)
                    return

            cursor = page.next_cursor
            pages_this_execution += 1

            if cursor is None:
                break

            if pages_this_execution >= input.continue_as_new_page_threshold:
                workflow.continue_as_new(
                    replace(
                        input,
                        cursor=cursor,
                        pages_this_execution=0,
                        total_items_written=total_items,
                        total_bytes_written=total_bytes,
                    )
                )
                return

        await self._finish(input.sync_run_id, SyncRun.Status.COMPLETED)

    async def _finish(self, sync_run_id: str, status: SyncRun.Status) -> None:
        await workflow.execute_activity(
            finish_run_activity,
            args=[sync_run_id, status],
            start_to_close_timeout=timedelta(seconds=30),
        )
