from django.urls import path

from apps.vas_recordings.api import views

urlpatterns = [
    path("video/sessions", views.sessions),
    path("video/sessions/<str:session_id>", views.session_detail),
    path("video/sessions/<str:session_id>/recording/start", views.recording_start),
    path("video/sessions/<str:session_id>/recording/stop", views.recording_stop),
    path("video/sessions/<str:session_id>/recordings", views.recordings),
    path("video/sessions/<str:session_id>/recordings/<str:recording_id>", views.recording_detail),
    path("video/sessions/<str:session_id>/playback-url", views.playback_url),
]
