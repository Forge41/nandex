from django.urls import path

from apps.ingest.api import views

app_name = "ingest"

urlpatterns = [
    path("documents/<str:raw_document_id>/ingest-status", views.ingest_status),
]
