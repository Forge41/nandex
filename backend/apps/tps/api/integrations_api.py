"""Connection endpoints — tps is stateless for OAuth state.

The caller (a future 'importer' app, or the frontend via a thin proxy) owns and validates
the OAuth state blob; tps just plugs it into the authorize URL on /install and trusts it
was already validated by the time /exchange is called.
"""

from django.http import HttpRequest, JsonResponse

from apps.tps.api.errors import parse_json_body, tps_view
from apps.tps.connection_service import create_connection, delete_connection, get_or_refresh
from apps.tps.deps import require_tps_secret, require_user_id
from apps.tps.handlers import get_credential_handler, get_oauth_handler
from apps.tps.models import Connection, Connector


@tps_view
async def install_app(request: HttpRequest, app_name: str) -> JsonResponse:
    require_tps_secret(request)
    body = parse_json_body(request)
    state, redirect_uri = body.get("state"), body.get("redirect_uri")
    if not state or not redirect_uri:
        return JsonResponse({"detail": "state and redirect_uri are required"}, status=400)

    try:
        connector = await Connector.objects.aget(app_name=app_name, active=True)
    except Connector.DoesNotExist:
        return JsonResponse({"detail": f"App '{app_name}' not found"}, status=404)
    if not connector.is_install_required:
        return JsonResponse({"detail": f"App '{app_name}' uses the credential flow"}, status=400)

    handler = get_oauth_handler(app_name)
    authorize_url, generated_state = handler.get_authorize_url(redirect_uri)
    # Swap the handler's own state for the caller's — tps doesn't validate state itself.
    authorize_url = authorize_url.replace(f"state={generated_state}", f"state={state}")

    return JsonResponse({"authorize_url": authorize_url})


@tps_view
async def exchange_oauth_code(request: HttpRequest, app_name: str) -> JsonResponse:
    require_tps_secret(request)
    user_id = require_user_id(request)
    body = parse_json_body(request)
    code, redirect_uri = body.get("code"), body.get("redirect_uri")
    if not code or not redirect_uri:
        return JsonResponse({"detail": "code and redirect_uri are required"}, status=400)

    handler = get_oauth_handler(app_name)
    config = await handler.exchange_code(code, redirect_uri)

    try:
        user_info = await handler.get_user_info(config)
    except Exception:
        user_info = {}

    identifier = user_info.get("login") or user_info.get("email")
    connection = await create_connection(
        user_id=user_id,
        app_name=app_name,
        config=config,
        identifier=identifier,
        expires_at=config.get("expires_at"),
    )

    return JsonResponse(
        {
            "connection_id": connection.id,
            "app_name": app_name,
            "identifier": identifier,
            "status": Connection.Status.ACTIVE,
        }
    )


@tps_view
async def connect_app(request: HttpRequest, app_name: str) -> JsonResponse:
    require_tps_secret(request)
    user_id = require_user_id(request)
    body = parse_json_body(request)
    credentials = body.get("credentials", {})

    try:
        connector = await Connector.objects.aget(app_name=app_name, active=True)
    except Connector.DoesNotExist:
        return JsonResponse({"detail": f"App '{app_name}' not found"}, status=404)
    if connector.is_install_required:
        return JsonResponse({"detail": f"App '{app_name}' uses the OAuth flow"}, status=400)

    for field in (connector.meta or {}).get("form_fields", []):
        if field.get("required") and field["reference_key"] not in credentials:
            return JsonResponse(
                {"detail": f"Missing required field: {field['display_name']}"}, status=400
            )

    handler = get_credential_handler(app_name)
    if not await handler.validate_credentials(credentials):
        return JsonResponse({"detail": "Credentials are invalid"}, status=400)

    connection = await create_connection(
        user_id=user_id,
        app_name=app_name,
        config=credentials,
        identifier=credentials.get("email") or credentials.get("username"),
    )

    return JsonResponse(
        {
            "connection_id": connection.id,
            "app_name": app_name,
            "identifier": connection.identifier,
            "status": Connection.Status.ACTIVE,
        }
    )


def _serialize_connection(connection: Connection) -> dict:
    return {
        "id": connection.id,
        "app_name": connection.app_name,
        "identifier": connection.identifier,
        "status": connection.status,
        "created_at": connection.created_at.isoformat(),
    }


@tps_view
async def list_connections(request: HttpRequest) -> JsonResponse:
    require_tps_secret(request)
    user_id = require_user_id(request)

    connections = Connection.objects.filter(user_id=user_id, status=Connection.Status.ACTIVE)
    return JsonResponse([_serialize_connection(c) async for c in connections], safe=False)


@tps_view
async def connection_detail(request: HttpRequest, identifier: str) -> JsonResponse:
    """GET /integrations/{identifier} (by app_name or id) and DELETE /integrations/{id}
    share one path shape, so they share one view and dispatch on request.method."""
    require_tps_secret(request)
    user_id = require_user_id(request)

    if request.method == "DELETE":
        deleted = await delete_connection(identifier, user_id)
        if not deleted:
            return JsonResponse({"detail": "Connection not found"}, status=404)
        return JsonResponse({"ok": True})

    connection = await Connection.objects.filter(
        user_id=user_id, app_name=identifier, status=Connection.Status.ACTIVE
    ).afirst()
    if connection is None:
        connection = await Connection.objects.filter(
            id=identifier, user_id=user_id, status=Connection.Status.ACTIVE
        ).afirst()
    if connection is None:
        return JsonResponse({"detail": "Connection not found"}, status=404)

    return JsonResponse(_serialize_connection(connection))


@tps_view
async def get_token(request: HttpRequest, connection_id: str) -> JsonResponse:
    """Return the decrypted access token — used by importer to make provider requests."""
    require_tps_secret(request)
    user_id = require_user_id(request)

    try:
        config = await get_or_refresh(connection_id, user_id)
    except ValueError:
        return JsonResponse({"detail": "Connection not found"}, status=404)

    access_token = config.get("access_token") or config.get("api_token")
    if not access_token:
        return JsonResponse({"detail": "No access token in connection config"}, status=400)
    return JsonResponse({"access_token": access_token})
