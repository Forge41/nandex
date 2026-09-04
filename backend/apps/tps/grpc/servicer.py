"""TpsService gRPC servicer — thin transport layer over the same connection_service /
handlers functions the old HTTP views called. No business logic lives here.
"""

import json
import logging

import grpc

from apps.tps.connection_service import create_connection, delete_connection, get_or_refresh
from apps.tps.grpc import tps_pb2, tps_pb2_grpc
from apps.tps.handlers import get_credential_handler, get_oauth_handler
from apps.tps.models import AppCategory, AppProvider, AuthType, Connection, Connector

logger = logging.getLogger(__name__)


def _app_to_proto(connector: Connector) -> tps_pb2.App:
    return tps_pb2.App(
        id=connector.id,
        app_code=connector.app_code,
        app_name=connector.app_name,
        display_name=connector.display_name,
        auth_type=AuthType(connector.auth_type).label,
        category=AppCategory(connector.category).label,
        provider=AppProvider(connector.provider).label,
        meta_json=json.dumps(connector.meta),
        is_install_required=connector.is_install_required,
    )


def _connection_to_proto(connection: Connection) -> tps_pb2.ConnectionSummary:
    return tps_pb2.ConnectionSummary(
        id=connection.id,
        app_name=connection.app_name,
        identifier=connection.identifier,
        status=connection.status,
        created_at=connection.created_at.isoformat(),
    )


class TpsServicer(tps_pb2_grpc.TpsServiceServicer):
    async def ListApps(self, request, context):
        connectors = Connector.objects.filter(active=True)
        if request.HasField("category"):
            connectors = connectors.filter(category=request.category)
        apps = [_app_to_proto(c) async for c in connectors]
        return tps_pb2.ListAppsResponse(apps=apps)

    async def GetApp(self, request, context):
        lookup = (
            {"app_code": int(request.identifier)}
            if request.identifier.isdigit()
            else {"app_name": request.identifier}
        )
        try:
            connector = await Connector.objects.aget(**lookup)
        except Connector.DoesNotExist:
            await context.abort(grpc.StatusCode.NOT_FOUND, f"App '{request.identifier}' not found")
        return _app_to_proto(connector)

    async def InstallApp(self, request, context):
        try:
            connector = await Connector.objects.aget(app_name=request.app_name, active=True)
        except Connector.DoesNotExist:
            await context.abort(grpc.StatusCode.NOT_FOUND, f"App '{request.app_name}' not found")
        if not connector.is_install_required:
            await context.abort(
                grpc.StatusCode.INVALID_ARGUMENT,
                f"App '{request.app_name}' uses the credential flow",
            )

        handler = get_oauth_handler(request.app_name)
        authorize_url, generated_state = handler.get_authorize_url(request.redirect_uri)
        authorize_url = authorize_url.replace(f"state={generated_state}", f"state={request.state}")
        return tps_pb2.InstallAppResponse(authorize_url=authorize_url)

    async def ExchangeCode(self, request, context):
        handler = get_oauth_handler(request.app_name)
        try:
            config = await handler.exchange_code(request.code, request.redirect_uri)
        except ValueError as e:
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, str(e))

        try:
            user_info = await handler.get_user_info(config)
        except Exception:
            user_info = {}

        identifier = user_info.get("login") or user_info.get("email")
        connection = await create_connection(
            project_id=request.project_id,
            app_name=request.app_name,
            config=config,
            identifier=identifier,
            expires_at=config.get("expires_at"),
        )
        return _connection_to_proto(connection)

    async def ConnectCredentials(self, request, context):
        try:
            connector = await Connector.objects.aget(app_name=request.app_name, active=True)
        except Connector.DoesNotExist:
            await context.abort(grpc.StatusCode.NOT_FOUND, f"App '{request.app_name}' not found")
        if connector.is_install_required:
            await context.abort(
                grpc.StatusCode.INVALID_ARGUMENT, f"App '{request.app_name}' uses the OAuth flow"
            )

        credentials = json.loads(request.credentials_json)
        for field in (connector.meta or {}).get("form_fields", []):
            if field.get("required") and field["reference_key"] not in credentials:
                await context.abort(
                    grpc.StatusCode.INVALID_ARGUMENT,
                    f"Missing required field: {field['display_name']}",
                )

        handler = get_credential_handler(request.app_name)
        if not await handler.validate_credentials(credentials):
            await context.abort(grpc.StatusCode.INVALID_ARGUMENT, "Credentials are invalid")

        connection = await create_connection(
            project_id=request.project_id,
            app_name=request.app_name,
            config=credentials,
            identifier=credentials.get("email") or credentials.get("username"),
        )
        return _connection_to_proto(connection)

    async def ListConnections(self, request, context):
        connections = Connection.objects.filter(
            project_id=request.project_id, status=Connection.Status.ACTIVE
        )
        summaries = [_connection_to_proto(c) async for c in connections]
        return tps_pb2.ListConnectionsResponse(connections=summaries)

    async def GetConnection(self, request, context):
        connection = await Connection.objects.filter(
            project_id=request.project_id,
            app_name=request.identifier,
            status=Connection.Status.ACTIVE,
        ).afirst()
        if connection is None:
            connection = await Connection.objects.filter(
                id=request.identifier,
                project_id=request.project_id,
                status=Connection.Status.ACTIVE,
            ).afirst()
        if connection is None:
            await context.abort(grpc.StatusCode.NOT_FOUND, "Connection not found")
        return _connection_to_proto(connection)

    async def GetToken(self, request, context):
        try:
            config = await get_or_refresh(request.connection_id, request.project_id)
        except ValueError:
            await context.abort(grpc.StatusCode.NOT_FOUND, "Connection not found")

        access_token = config.get("access_token") or config.get("api_token")
        if not access_token:
            await context.abort(
                grpc.StatusCode.FAILED_PRECONDITION, "No access token in connection config"
            )
        return tps_pb2.GetTokenResponse(access_token=access_token)

    async def DeleteConnection(self, request, context):
        deleted = await delete_connection(request.connection_id, request.project_id)
        if not deleted:
            await context.abort(grpc.StatusCode.NOT_FOUND, "Connection not found")
        return tps_pb2.DeleteConnectionResponse(ok=True)
