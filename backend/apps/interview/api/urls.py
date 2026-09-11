from django.urls import path

from apps.interview.api import callbacks, views

app_name = "interview"

urlpatterns = [
    path("interview/sessions", views.sessions),
    # GET and PATCH share one path; Django dispatches by URL, not verb, so these cannot
    # be two entries.
    path("interview/sessions/<str:session_id>", views.session_detail),
    path("interview/sessions/<str:session_id>/resume", views.session_resume),
    path("interview/sessions/<str:session_id>/token", views.session_token),
    path("interview/sessions/<str:session_id>/recording", views.session_recording),
    path("interview/sessions/<str:session_id>/end", views.session_end),
    path("interview/callbacks/vas", callbacks.vas_callback),
]
