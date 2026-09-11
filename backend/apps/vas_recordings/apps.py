from django.apps import AppConfig


class VasRecordingsConfig(AppConfig):
    # The label is prefixed because django_migrations is one table for the whole project:
    # an app literally named "sessions" would collide with django.contrib.sessions.
    name = "apps.vas_recordings"
    label = "vas_recordings"
