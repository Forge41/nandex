from django.urls import path

from apps.vas_compliance.api import views

urlpatterns = [
    path("video/sessions/<str:session_id>/artifacts", views.artifacts),
    path("video/sessions/<str:session_id>/artifacts/<str:deletion_id>", views.deletion_detail),
]
