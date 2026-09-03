"""Provider adapter registry — one entry per connector, keyed by slug (see
integrations.yaml / apps.tps.catalog.IntegrationSlug). Empty until a real connector ships.
"""

PROVIDER_REGISTRY: dict[str, type] = {}
