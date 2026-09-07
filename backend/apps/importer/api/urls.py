from django.urls import path

from apps.importer.api import views

app_name = "importer"

urlpatterns = [
    path("documents/upload", views.upload_document),
]
