"""Google Drive provider adapter — lists and downloads files. Auth lives in
apps.tps.handlers.google_drive; this only ever receives an already-valid access token.
"""

import httpx

from apps.importer.errors import (
    AuthExpiredError,
    PermanentProviderError,
    RateLimitedError,
    TransientProviderError,
)
from apps.importer.providers.base import DownloadedItem, ItemRef, Page
from apps.importer.retry import provider_retry
from apps.tps.catalog import IntegrationSlug

API_BASE = "https://www.googleapis.com/drive/v3"
PAGE_SIZE = 100
MAX_ITEM_BYTES = 25 * 1024 * 1024

# Native Google file types have no downloadable binary — they must be exported instead.
# Maps a listed mimeType to the (export mimeType, content_type to store).
EXPORT_MIME_MAP = {
    "application/vnd.google-apps.document": (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ),
    "application/vnd.google-apps.spreadsheet": (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    ),
    "application/vnd.google-apps.presentation": (
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ),
    "application/vnd.google-apps.drawing": "image/png",
}


def _quota_reasons(data: dict) -> set[str]:
    errors = data.get("error", {}).get("errors", [])
    return {e.get("reason", "") for e in errors}


def _raise_for_error_response(response: httpx.Response) -> None:
    if response.status_code < 400:
        return

    try:
        data = response.json()
    except ValueError:
        data = {}

    if response.status_code == 401:
        raise AuthExpiredError("Google access token rejected")

    if response.status_code == 429:
        retry_after = response.headers.get("Retry-After")
        raise RateLimitedError(
            "Google rate limit (429)", retry_after=float(retry_after) if retry_after else None
        )

    if response.status_code == 403:
        reasons = _quota_reasons(data)
        if reasons & {"userRateLimitExceeded", "rateLimitExceeded", "dailyLimitExceeded"}:
            raise RateLimitedError(f"Google quota exceeded: {reasons}")
        raise PermanentProviderError(f"Google 403: {reasons or data}")

    if response.status_code == 404:
        raise PermanentProviderError("Google Drive item not found (deleted since listing?)")

    if response.status_code >= 500:
        raise TransientProviderError(f"Google {response.status_code}")

    raise PermanentProviderError(f"Google {response.status_code}: {data}")


class GoogleDriveProviderAdapter:
    def get_app_name(self) -> IntegrationSlug:
        return IntegrationSlug.GOOGLE_DRIVE

    @provider_retry
    async def _get(self, url: str, access_token: str, params: dict) -> httpx.Response:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url, headers={"Authorization": f"Bearer {access_token}"}, params=params
            )
            _raise_for_error_response(response)
            return response

    async def list_page(self, access_token: str, cursor: str | None) -> Page:
        params = {
            "pageSize": PAGE_SIZE,
            "corpora": "allDrives",
            "includeItemsFromAllDrives": "true",
            "supportsAllDrives": "true",
            "orderBy": "modifiedTime",
            "q": "trashed=false",
            "fields": "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
        }
        if cursor:
            params["pageToken"] = cursor

        response = await self._get(f"{API_BASE}/files", access_token, params)
        data = response.json()

        items = [
            ItemRef(
                id=f["id"],
                name=f["name"],
                mime_type=f["mimeType"],
                version=f["modifiedTime"],
                size=int(f["size"]) if "size" in f else None,
            )
            for f in data.get("files", [])
        ]
        return Page(items=items, next_cursor=data.get("nextPageToken"))

    async def download_item(self, access_token: str, item: ItemRef) -> DownloadedItem:
        if item.size is not None and item.size > MAX_ITEM_BYTES:
            raise PermanentProviderError(
                f"{item.id} is {item.size} bytes, over the {MAX_ITEM_BYTES} limit"
            )

        export_mime = EXPORT_MIME_MAP.get(item.mime_type)
        if export_mime:
            response = await self._get(
                f"{API_BASE}/files/{item.id}/export", access_token, {"mimeType": export_mime}
            )
            content_type = export_mime
        else:
            response = await self._get(
                f"{API_BASE}/files/{item.id}", access_token, {"alt": "media"}
            )
            content_type = item.mime_type

        if len(response.content) > MAX_ITEM_BYTES:
            raise PermanentProviderError(
                f"{item.id} exported to {len(response.content)} bytes, over the "
                f"{MAX_ITEM_BYTES} limit"
            )

        return DownloadedItem(item=item, payload=response.content, content_type=content_type)
