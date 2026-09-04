from django.urls import path

from apps.core.api import views

app_name = "core"

urlpatterns = [
    path("auth/login", views.request_login),
    path("auth/verify", views.verify_login),
    path("auth/logout", views.logout_view),
    path("projects", views.projects),
    path("projects/<str:project_id>", views.project_detail),
]
