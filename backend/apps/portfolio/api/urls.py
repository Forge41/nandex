from django.urls import path

from apps.portfolio.api import views

app_name = "portfolio"

urlpatterns = [
    path("portfolio/ask", views.ask),
    path("portfolio/fit", views.fit),
    path("portfolio/message", views.message),
    path("portfolio/voice/token", views.voice_token),
    path("portfolio/agent/passages", views.agent_passages),
    path("portfolio/agent/speech-key-alert", views.agent_speech_key_alert),
]
