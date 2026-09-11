"""GCS storage for finished recordings.

Every method is async so the protocol is one shape regardless of backend; the google
client is synchronous, so its calls go through sync_to_async rather than blocking the
event loop.
"""

import datetime
import urllib.parse

from asgiref.sync import sync_to_async

from apps.vas_recordings.providers.base import StorageUploadConfig


class GCSStorageProvider:
    def __init__(self, bucket: str, endpoint_override: str = "") -> None:
        self._bucket_name = bucket
        self._endpoint_override = endpoint_override
        self._client = None

    def _get_client(self):
        # Imported and constructed lazily: the module is loaded at django.setup(), and a
        # deployment that never records must not need google credentials to boot.
        if self._client is None:
            from google.cloud import storage

            if self._endpoint_override:
                from google.api_core.client_options import ClientOptions
                from google.auth.credentials import AnonymousCredentials

                self._client = storage.Client(
                    credentials=AnonymousCredentials(),
                    client_options=ClientOptions(api_endpoint=self._endpoint_override),
                    project="local-dev",
                )
            else:
                self._client = storage.Client()
        return self._client

    def _blob(self, path: str):
        return self._get_client().bucket(self._bucket_name).blob(path)

    def upload_config(self, path: str) -> StorageUploadConfig:
        return StorageUploadConfig(backend="gcs", bucket=self._bucket_name, path=path)

    async def signed_url(self, path: str, expiry_seconds: int) -> str:
        if self._endpoint_override:
            # fake-gcs has no credentials to sign with, so there is nothing to sign.
            encoded = urllib.parse.quote(path, safe="")
            return (
                f"{self._endpoint_override}/download/storage/v1/b/"
                f"{self._bucket_name}/o/{encoded}?alt=media"
            )
        blob = await sync_to_async(self._blob)(path)
        return await sync_to_async(blob.generate_signed_url)(
            expiration=datetime.timedelta(seconds=expiry_seconds), method="GET", version="v4"
        )

    async def object_exists(self, path: str) -> bool:
        blob = await sync_to_async(self._blob)(path)
        return await sync_to_async(blob.exists)()

    async def delete_object(self, path: str) -> None:
        blob = await sync_to_async(self._blob)(path)
        try:
            await sync_to_async(blob.delete)()
        except Exception as e:
            if "404" in str(e) or "Not Found" in str(e):
                return
            raise
