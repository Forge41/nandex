"""Resolves which RawDocuments a project may see. Lives here, not in apps.core, since core
must not import apps.importer (core is the base of the dependency chain; apps.chat sits at
the top and may depend on everything below it: core, tps via its gRPC client, importer's
models directly, retrieval)."""

from django.db.models import Q

from apps.core.clients import tps_client
from apps.importer.models import RawDocument


async def resolve_visible_raw_document_ids(project_id: str) -> list[str]:
    connections = await tps_client.list_connections(project_id)
    connection_ids = [c["id"] for c in connections]

    # A directly-uploaded document (connection_id="upload") has no Connection to resolve a
    # project through, so it's matched on RawDocument.project_id directly instead -- see
    # apps.importer.models.RawDocument.project_id.
    visibility = Q(project_id=project_id)
    if connection_ids:
        visibility |= Q(connection_id__in=connection_ids)

    return [
        doc_id
        async for doc_id in RawDocument.objects.filter(visibility).values_list("id", flat=True)
    ]
