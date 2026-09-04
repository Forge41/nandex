"""gRPC client for tps — the only way apps.core talks to apps.tps.

Even though both apps live in the same Django process, this stays a real RPC boundary
(not a direct Python import of apps.tps's internals) so tps could be split into its own
deployment later without a rewrite here.
"""

import json

import grpc

from apps.core.config import settings
from apps.tps.grpc import tps_pb2, tps_pb2_grpc

_channel: grpc.aio.Channel | None = None


def _get_channel() -> grpc.aio.Channel:
    global _channel
    if _channel is None:
        _channel = grpc.aio.insecure_channel(settings.tps_grpc_address)
    return _channel


def _metadata() -> tuple[tuple[str, str], ...]:
    return (("x-tps-secret", settings.tps_secret),)


async def list_apps(category: int | None = None) -> list[dict]:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    request = (
        tps_pb2.ListAppsRequest(category=category)
        if category is not None
        else tps_pb2.ListAppsRequest()
    )
    response = await stub.ListApps(request, metadata=_metadata())
    return [_app_to_dict(a) for a in response.apps]


async def get_app(identifier: str) -> dict:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.GetApp(tps_pb2.GetAppRequest(identifier=identifier), metadata=_metadata())
    return _app_to_dict(response)


async def install_app(app_name: str, state: str, redirect_uri: str) -> str:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.InstallApp(
        tps_pb2.InstallAppRequest(app_name=app_name, state=state, redirect_uri=redirect_uri),
        metadata=_metadata(),
    )
    return response.authorize_url


async def exchange_code(project_id: str, app_name: str, code: str, redirect_uri: str) -> dict:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.ExchangeCode(
        tps_pb2.ExchangeCodeRequest(
            project_id=project_id, app_name=app_name, code=code, redirect_uri=redirect_uri
        ),
        metadata=_metadata(),
    )
    return _connection_to_dict(response)


async def connect_credentials(project_id: str, app_name: str, credentials: dict) -> dict:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.ConnectCredentials(
        tps_pb2.ConnectCredentialsRequest(
            project_id=project_id, app_name=app_name, credentials_json=json.dumps(credentials)
        ),
        metadata=_metadata(),
    )
    return _connection_to_dict(response)


async def list_connections(project_id: str) -> list[dict]:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.ListConnections(
        tps_pb2.ListConnectionsRequest(project_id=project_id), metadata=_metadata()
    )
    return [_connection_to_dict(c) for c in response.connections]


async def get_connection(project_id: str, identifier: str) -> dict:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.GetConnection(
        tps_pb2.GetConnectionRequest(project_id=project_id, identifier=identifier),
        metadata=_metadata(),
    )
    return _connection_to_dict(response)


async def get_token(project_id: str, connection_id: str) -> str:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.GetToken(
        tps_pb2.GetTokenRequest(project_id=project_id, connection_id=connection_id),
        metadata=_metadata(),
    )
    return response.access_token


async def delete_connection(project_id: str, connection_id: str) -> bool:
    stub = tps_pb2_grpc.TpsServiceStub(_get_channel())
    response = await stub.DeleteConnection(
        tps_pb2.DeleteConnectionRequest(project_id=project_id, connection_id=connection_id),
        metadata=_metadata(),
    )
    return response.ok


def _app_to_dict(app) -> dict:
    return {
        "id": app.id,
        "app_code": app.app_code,
        "app_name": app.app_name,
        "display_name": app.display_name,
        "auth_type": app.auth_type,
        "category": app.category,
        "provider": app.provider,
        "meta": json.loads(app.meta_json) if app.meta_json else {},
        "is_install_required": app.is_install_required,
    }


def _connection_to_dict(connection) -> dict:
    return {
        "id": connection.id,
        "app_name": connection.app_name,
        "identifier": connection.identifier,
        "status": connection.status,
        "created_at": connection.created_at,
    }
