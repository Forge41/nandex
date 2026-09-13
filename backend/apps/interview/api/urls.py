from django.urls import path

from apps.interview.api import agent, callbacks, coding_views, views

app_name = "interview"

urlpatterns = [
    path("interview/sessions", views.sessions),
    # GET and PATCH share one path; Django dispatches by URL, not verb, so these cannot
    # be two entries.
    path("interview/sessions/<str:session_id>", views.session_detail),
    path("interview/sessions/<str:session_id>/resume", views.session_resume),
    path("interview/sessions/<str:session_id>/resume/file", views.session_resume_file),
    path("interview/sessions/<str:session_id>/plan", views.session_plan),
    path("interview/sessions/<str:session_id>/token", views.session_token),
    path(
        "interview/sessions/<str:session_id>/rounds/<str:stage_id>/draft",
        coding_views.session_draft,
    ),
    # GET lists past attempts, POST takes one. One path, dispatched by verb inside.
    path(
        "interview/sessions/<str:session_id>/rounds/<str:stage_id>/runs", coding_views.session_runs
    ),
    path(
        "interview/sessions/<str:session_id>/rounds/<str:stage_id>/tasks/<int:task_index>"
        "/languages/<str:language>",
        coding_views.session_language,
    ),
    path("interview/sessions/<str:session_id>/recording", views.session_recording),
    path("interview/sessions/<str:session_id>/end", views.session_end),
    path("interview/callbacks/vas", callbacks.vas_callback),
    # The interviewer agent's own door: a shared bearer token, no candidate cookie.
    path("interview/agent/sessions/<str:session_id>/brief", agent.session_brief),
    path("interview/agent/sessions/<str:session_id>/transcript", agent.session_transcript),
]
