from django.urls import path

from apps.runner.api import views

app_name = "runner"

urlpatterns = [path("runner/runs", views.runs)]
