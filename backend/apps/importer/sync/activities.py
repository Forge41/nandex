"""SyncWorkflow's activities. Split so no activity both talks to a provider's HTTP API
and to the DB — list/download activities only ever call the provider; the write
activity only ever calls the DB. See the importer LLD's "DB session never held across
I/O" invariant for why that split matters.
"""

import asyncio

from asgiref.sync import sync_to_async
from django.db import transaction
from django.db.models import F
from temporalio import activity

from apps.importer.clients.tps_client import get_token as _tps_get_token
from apps.importer.clients.tps_client import mark_reauth_required as _tps_mark_reauth_required
from apps.importer.errors import PermanentProviderError, ProviderError
from apps.importer.models import RawDocument, SyncItemFailure, SyncRun
from apps.importer.providers import PROVIDER_REGISTRY
from apps.importer.providers.base import DownloadedItem, ItemRef, Page, SyncItemFailureRecord
from apps.importer.retry import as_temporal_error

DOWNLOAD_CONCURRENCY = 5


def _get_adapter(app_name: str):
    """app_name stays a plain str here, deliberately, even though apps.tps.catalog has a
    real IntegrationSlug enum: IntegrationSlug is built dynamically (enum.Enum(...) as a
    function call, not a class statement), and Temporal's data converter cannot correctly
    reconstruct a dynamically-created enum type across the workflow/activity serialization
    boundary — it silently corrupts the value instead of raising. This bit us for real:
    every activity/workflow-dataclass parameter that crosses that boundary must stay str
    (or a *statically* defined enum, like SyncRun.Status below, which works fine).
    """
    adapter_cls = PROVIDER_REGISTRY.get(app_name)
    if not adapter_cls:
        raise ValueError(f"No provider adapter for app: {app_name}")
    return adapter_cls()


@activity.defn
async def get_token_activity(project_id: str, connection_id: str) -> str:
    return await _tps_get_token(project_id, connection_id)


@activity.defn
async def mark_reauth_required_activity(project_id: str, connection_id: str) -> None:
    await _tps_mark_reauth_required(project_id, connection_id)


@activity.defn
async def list_page_activity(app_name: str, access_token: str, cursor: str | None) -> Page:
    adapter = _get_adapter(app_name)
    try:
        return await adapter.list_page(access_token, cursor)
    except ProviderError as e:
        raise as_temporal_error(e) from e


def _skip_unchanged_sync(connection_id: str, items: list[ItemRef]) -> list[ItemRef]:
    existing = set(
        RawDocument.objects.filter(
            connection_id=connection_id, provider_document_id__in=[i.id for i in items]
        ).values_list("provider_document_id", "provider_version")
    )
    return [i for i in items if (i.id, i.version) not in existing]


@activity.defn
async def skip_unchanged_activity(connection_id: str, items: list[ItemRef]) -> list[ItemRef]:
    """Drops items whose (id, version) already have a matching RawDocument — nothing to
    do for those, they're already current. Cuts the download cost of every recurring
    sync down to just what actually changed since the last run."""
    return await sync_to_async(_skip_unchanged_sync, thread_sensitive=True)(connection_id, items)


@activity.defn
async def download_batch_activity(
    app_name: str, access_token: str, items: list[ItemRef]
) -> list[DownloadedItem | SyncItemFailureRecord]:
    """Every item gets its own outcome — success or a typed failure record — and neither
    kind ever fails this whole activity. A batch call failing outright (this activity
    raising) is reserved for something breaking the batch itself, not one file's problem;
    Temporal would otherwise retry all 20 items to fix one.
    """
    adapter = _get_adapter(app_name)
    semaphore = asyncio.Semaphore(DOWNLOAD_CONCURRENCY)

    async def download_one(item: ItemRef) -> DownloadedItem | SyncItemFailureRecord:
        async with semaphore:
            try:
                return await adapter.download_item(access_token, item)
            except PermanentProviderError as e:
                return SyncItemFailureRecord(item.id, SyncItemFailure.FailureType.PERMANENT, str(e))
            except ProviderError as e:
                # tenacity already retried this inside download_item and gave up —
                # bucket it as data, same as a permanent failure, rather than failing
                # the other 19 items in this batch over one still-failing item.
                return SyncItemFailureRecord(
                    item.id, SyncItemFailure.FailureType.TRANSIENT_EXHAUSTED, str(e)
                )

    return list(await asyncio.gather(*(download_one(i) for i in items)))


def _write_results_sync(
    connection_id: str, sync_run_id: str, results: list[DownloadedItem | SyncItemFailureRecord]
) -> tuple[int, int, int]:
    successes = [r for r in results if isinstance(r, DownloadedItem)]
    failures = [r for r in results if isinstance(r, SyncItemFailureRecord)]

    bytes_written = 0
    with transaction.atomic():
        if successes:
            RawDocument.objects.bulk_create(
                [
                    RawDocument(
                        connection_id=connection_id,
                        provider_document_id=r.item.id,
                        provider_version=r.item.version,
                        payload=r.payload,
                        content_type=r.content_type,
                    )
                    for r in successes
                ],
                update_conflicts=True,
                unique_fields=["connection_id", "provider_document_id", "provider_version"],
                update_fields=["payload", "content_type", "fetched_at"],
            )
            bytes_written = sum(len(r.payload) for r in successes)

        if failures:
            SyncItemFailure.objects.bulk_create(
                [
                    SyncItemFailure(
                        sync_run_id=sync_run_id,
                        provider_document_id=f.item_id,
                        failure_type=f.failure_type,
                        error_message=f.error_message,
                    )
                    for f in failures
                ]
            )

        # Cumulative, for anyone querying SyncRun's status directly -- the workflow
        # also tracks its own running total from the return value below, since it
        # can't read the DB itself, but this is what a status API would show.
        SyncRun.objects.filter(id=sync_run_id).update(
            items_written=F("items_written") + len(successes),
            items_failed=F("items_failed") + len(failures),
            bytes_written=F("bytes_written") + bytes_written,
        )

    return len(successes), len(failures), bytes_written


@activity.defn
async def write_raw_documents_activity(
    connection_id: str, sync_run_id: str, results: list[DownloadedItem | SyncItemFailureRecord]
) -> tuple[int, int, int]:
    """Returns (items_written, items_failed, bytes_written) so the workflow can
    accumulate run-level totals itself without doing any DB reads of its own."""
    return await sync_to_async(_write_results_sync, thread_sensitive=True)(
        connection_id, sync_run_id, results
    )


def _advance_cursor_sync(sync_run_id: str, cursor: str | None) -> None:
    SyncRun.objects.filter(id=sync_run_id).update(cursor=cursor or "")


@activity.defn
async def advance_cursor_activity(sync_run_id: str, cursor: str | None) -> None:
    await sync_to_async(_advance_cursor_sync, thread_sensitive=True)(sync_run_id, cursor)


def _finish_run_sync(sync_run_id: str, status: SyncRun.Status) -> None:
    from django.utils import timezone

    SyncRun.objects.filter(id=sync_run_id).update(status=status, finished_at=timezone.now())


@activity.defn
async def finish_run_activity(sync_run_id: str, status: SyncRun.Status) -> None:
    await sync_to_async(_finish_run_sync, thread_sensitive=True)(sync_run_id, status)
