"""tps app configuration — credential encryption keys and per-provider OAuth settings.

Separate from Django's own settings.py: this is config that only the tps app needs,
not shared with the rest of the backend.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Encryption — comma-separated for key rotation (first key is active)
    fernet_keys: str = ""  # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    # Internal service auth — shared secret required on every tps request
    tps_secret: str = "dev-tps-secret-change-in-production"

    # Per-provider OAuth credentials go here as connectors are added, e.g.:
    #   github_client_id: str = ""
    #   github_client_secret: str = ""

    model_config = {"env_prefix": "TPS_"}


settings = Settings()
