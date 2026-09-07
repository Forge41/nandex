from django.urls import path

from apps.core.api import marketplace_views, views

app_name = "core"

urlpatterns = [
    path("auth/login", views.request_login),
    path("auth/verify", views.verify_login),
    path("auth/logout", views.logout_view),
    path("auth/session", views.session),
    path("projects", views.projects),
    path("projects/<str:project_id>", views.project_detail),
    path("apps", marketplace_views.list_apps),
    path("connections", marketplace_views.list_connections),
    path("apps/<str:app_name>/install", marketplace_views.install_app),
    path("apps/<str:app_name>/connect", marketplace_views.connect_app),
    path("oauth/callback", marketplace_views.oauth_callback),
    path("connections/<str:connection_id>", marketplace_views.connection_detail),
]
