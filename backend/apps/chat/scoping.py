"""Resolves which RawDocuments a project may see. Lives here, not in apps.core, since core
must not import apps.importer (core is the base of the dependency chain; apps.chat sits at
the top and may depend on everything below it: core, tps via its gRPC client, importer's
models directly, retrieval)."""

from apps.core.clients import tps_client
from apps.importer.models import RawDocument


async def resolve_visible_raw_document_ids(project_id: str) -> list[str]:
    connections = await tps_client.list_connections(project_id)
    connection_ids = [c["id"] for c in connections]
    if not connection_ids:
        return []
    return [
        doc_id
        async for doc_id in RawDocument.objects.filter(
            connection_id__in=connection_ids
        ).values_list("id", flat=True)
    ]
