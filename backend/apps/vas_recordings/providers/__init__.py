"""Provider registries, keyed by the name in settings.

Instances are cached per process: they hold nothing per-request, and building a storage
client on every call would be wasteful.
"""

from apps.vas_recordings.config import settings
from apps.vas_recordings.providers.base import (
    EgressProvider,
    StorageProvider,
    WebhookValidator,
)

_egress: EgressProvider | None = None
_validator: WebhookValidator | None = None
_storage: StorageProvider | None = None


def _build_livekit_egress() -> EgressProvider:
    from apps.vas_recordings.providers.livekit import LiveKitEgressProvider

    return LiveKitEgressProvider(
        settings.livekit_host, settings.livekit_api_key, settings.livekit_api_secret
    )


def _build_livekit_validator() -> WebhookValidator:
    from apps.vas_recordings.providers.livekit import LiveKitWebhookValidator

    return LiveKitWebhookValidator(
        settings.livekit_api_key, settings.livekit_api_secret, settings.webhook_max_age_seconds
    )


def _build_gcs_storage() -> StorageProvider:
    from apps.vas_recordings.providers.gcs import GCSStorageProvider

    return GCSStorageProvider(settings.gcs_bucket_name, settings.gcs_endpoint_override)


EGRESS_BUILDERS = {"livekit": _build_livekit_egress}
VALIDATOR_BUILDERS = {"livekit": _build_livekit_validator}
STORAGE_BUILDERS = {"gcs": _build_gcs_storage}


def _resolve(cache_name: str, builders: dict, name: str):
    cached = globals()[cache_name]
    if cached is not None:
        return cached
    builder = builders.get(name)
    if builder is None:
        raise ValueError(f"Unknown provider: {name!r}")
    globals()[cache_name] = builder()
    return globals()[cache_name]


def get_egress_provider() -> EgressProvider:
    return _resolve("_egress", EGRESS_BUILDERS, settings.egress_provider)


def get_webhook_validator() -> WebhookValidator:
    return _resolve("_validator", VALIDATOR_BUILDERS, settings.egress_provider)


def get_storage_provider() -> StorageProvider:
    return _resolve("_storage", STORAGE_BUILDERS, settings.storage_provider)
