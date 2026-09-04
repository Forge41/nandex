"""Provider adapter contract — tps.handlers covers auth; this covers actually listing
and downloading data, which must not live in tps (see the importer LLD's module
boundary section).
"""

from dataclasses import dataclass
from typing import Protocol

from apps.importer.models import SyncItemFailure
from apps.tps.catalog import IntegrationSlug


@dataclass(frozen=True)
class ItemRef:
    """One listed item — a file, a message, a record, whatever the provider calls it."""

    id: str
    name: str
    mime_type: str
    version: str  # opaque, provider-defined — becomes RawDocument.provider_version
    size: int | None = None  # None when the provider doesn't report size up front


@dataclass(frozen=True)
class Page:
    items: list[ItemRef]
    next_cursor: str | None


@dataclass(frozen=True)
class DownloadedItem:
    item: ItemRef
    payload: bytes
    content_type: str


@dataclass(frozen=True)
class SyncItemFailureRecord:
    item_id: str
    failure_type: SyncItemFailure.FailureType
    error_message: str


class ProviderAdapter(Protocol):
    """list_page and download_item raise apps.importer.errors.ProviderError subclasses on
    failure — they never return a failure value themselves. Isolating one item's failure
    from the rest of a batch (catch -> SyncItemFailureRecord) is the calling activity's
    job, not the adapter's; the adapter's contract stays simple: succeed, or raise.
    """

    def get_app_name(self) -> IntegrationSlug: ...

    async def list_page(self, access_token: str, cursor: str | None) -> Page: ...

    async def download_item(self, access_token: str, item: ItemRef) -> DownloadedItem: ...
