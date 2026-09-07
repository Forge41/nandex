"""Provider adapter registry — one entry per connector, keyed by slug (see
integrations.yaml / apps.tps.catalog.IntegrationSlug).
"""

from apps.importer.providers.google_drive import GoogleDriveProviderAdapter
from apps.tps.catalog import IntegrationSlug

PROVIDER_REGISTRY: dict[IntegrationSlug, type] = {
    IntegrationSlug.GOOGLE_DRIVE: GoogleDriveProviderAdapter,
}
