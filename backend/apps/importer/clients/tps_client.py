"""gRPC client for tps — the only way apps.importer talks to apps.tps.

Only the two RPCs importer actually needs: fetching a valid access token, and reporting
a connection that needs re-auth. importer has no reason to call ListApps/InstallApp/
ExchangeCode — those are apps.core's job.
"""

import grpc

from apps.importer.config import settings
from apps.tps.grpc import tps_pb2, tps_pb2_grpc

_channel: grpc.aio.Channel | None = None


def _get_channel() -> grpc.aio.Channel:
    global _channel
    if _channel is None:
        _channel = grpc.aio.insecure_channel(settings.tps_grpc_address)
    return _channel


def _metadata() -> tuple[tuple[str, str], ...]:
    return (("x-tps-secret", settings.tps_secret),)


async def get_token(project_id: str, connection_id: str) -> str:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.GetToken(
        tps_pb2.GetTokenRequest(project_id=project_id, connection_id=connection_id),
        metadata=_metadata(),
    )
    return response.access_token


async def mark_reauth_required(project_id: str, connection_id: str) -> bool:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.MarkReauthRequired(
        tps_pb2.MarkReauthRequiredRequest(project_id=project_id, connection_id=connection_id),
        metadata=_metadata(),
    )
    return response.ok
