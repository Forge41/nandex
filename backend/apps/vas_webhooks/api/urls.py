from django.urls import path

from apps.vas_webhooks.api import views

urlpatterns = [
    path("webhooks/livekit", views.livekit),
]
