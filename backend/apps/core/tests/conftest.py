import pytest


@pytest.fixture(autouse=True)
def _locmem_email(settings):
    settings.EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
