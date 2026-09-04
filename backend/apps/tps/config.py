"""tps app configuration — credential encryption keys and per-provider OAuth settings.

Separate from Django's own settings.py: this is config that only the tps app needs,
not shared with the rest of the backend.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Encryption — comma-separated for key rotation (first key is active)
    fernet_keys: str = ""  # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

    # Internal service auth — shared secret required on every tps gRPC call
    tps_secret: str = "dev-tps-secret-change-in-production"

    # gRPC server — the only interface apps.core is allowed to reach tps through
    grpc_port: int = 50051

    # Per-provider OAuth credentials
    google_drive_client_id: str = ""
    google_drive_client_secret: str = ""
    google_drive_redirect_uri: str = "http://localhost:3000/connect/google_drive/callback"
    google_drive_scopes: str = "https://www.googleapis.com/auth/drive.readonly openid email"

    model_config = {"env_prefix": "TPS_"}


settings = Settings()
