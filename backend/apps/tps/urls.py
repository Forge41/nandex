from django.urls import path

from apps.tps.api import apps_api, integrations_api

app_name = "tps"

urlpatterns = [
    path("apps", apps_api.list_apps),
    path("apps/<str:identifier>", apps_api.get_app),
    path("integrations", integrations_api.list_connections),
    path("integrations/<str:app_name>/install", integrations_api.install_app),
    path("integrations/<str:app_name>/exchange", integrations_api.exchange_oauth_code),
    path("integrations/<str:app_name>/connect", integrations_api.connect_app),
    path("integrations/<str:connection_id>/token", integrations_api.get_token),
    path("integrations/<str:identifier>", integrations_api.connection_detail),
]
