"""Connector catalog endpoints — GET /apps, GET /apps/{identifier}."""

from django.http import HttpRequest, JsonResponse

from apps.tps.api.errors import tps_view
from apps.tps.deps import require_tps_secret
from apps.tps.models import AppCategory, AppProvider, AuthType, Connector


def _serialize(connector: Connector) -> dict:
    return {
        "id": connector.id,
        "app_code": connector.app_code,
        "app_name": connector.app_name,
        "display_name": connector.display_name,
        "auth_type": AuthType(connector.auth_type).label,
        "category": AppCategory(connector.category).label,
        "provider": AppProvider(connector.provider).label,
        "meta": connector.meta,
        "is_install_required": connector.is_install_required,
    }


@tps_view
async def list_apps(request: HttpRequest) -> JsonResponse:
    require_tps_secret(request)
    category = request.GET.get("category")

    connectors = Connector.objects.filter(active=True)
    if category is not None:
        connectors = connectors.filter(category=int(category))

    return JsonResponse([_serialize(c) async for c in connectors], safe=False)


@tps_view
async def get_app(request: HttpRequest, identifier: str) -> JsonResponse:
    require_tps_secret(request)

    lookup = {"app_code": int(identifier)} if identifier.isdigit() else {"app_name": identifier}
    try:
        connector = await Connector.objects.aget(**lookup)
    except Connector.DoesNotExist:
        return JsonResponse({"detail": f"App '{identifier}' not found"}, status=404)

    return JsonResponse(_serialize(connector))
