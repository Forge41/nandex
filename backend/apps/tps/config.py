"""tps app configuration — credential encryption keys and per-provider OAuth settings.

Separate from Django's own settings.py: this is config that only the tps app needs,
not shared with the rest of the backend.
"""

from pydantic import AliasChoices, Field
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

    # Platform-level realtime provider credentials. A project that brings its own
    # LiveKit deployment overrides these through a Connection; these are the fallback.
    # LiveKit, the realtime room provider. These read the unprefixed LIVEKIT_* names --
    # one credential, one place to rotate. tps signs join tokens with them, the agent
    # connects with them, and vas would use them for Egress; three prefixed copies of
    # one secret was three chances to rotate two of them. The app boundary is kept by
    # each app declaring its own setting, not by each app having its own env var.
    livekit_host: str = Field(
        "ws://localhost:7880",
        validation_alias=AliasChoices("LIVEKIT_URL", "TPS_LIVEKIT_HOST"),
    )
    livekit_api_key: str = Field(
        "",
        validation_alias=AliasChoices("LIVEKIT_API_KEY", "TPS_LIVEKIT_API_KEY"),
    )
    livekit_api_secret: str = Field(
        "",
        validation_alias=AliasChoices("LIVEKIT_API_SECRET", "TPS_LIVEKIT_API_SECRET"),
    )

    model_config = {"env_prefix": "TPS_"}


settings = Settings()
