"""vas configuration, shared by the sibling vas_* apps -- they are one service split into
three Django apps, so this is not a cross-service import.

The LiveKit credentials here are not a duplicate of tps's: Egress is itself a LiveKit API
call, so the recorder needs its own client even though tps is the only token issuer.
"""

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    egress_provider: str = "livekit"
    storage_provider: str = "gcs"

    # LiveKit, the realtime room provider. These read the unprefixed LIVEKIT_* names --
    # one credential, one place to rotate. tps signs join tokens with them, the agent
    # connects with them, and vas would use them for Egress; three prefixed copies of
    # one secret was three chances to rotate two of them. The app boundary is kept by
    # each app declaring its own setting, not by each app having its own env var.
    livekit_host: str = Field(
        "ws://localhost:7880",
        validation_alias=AliasChoices("LIVEKIT_URL", "VAS_LIVEKIT_HOST"),
    )
    livekit_api_key: str = Field(
        "",
        validation_alias=AliasChoices("LIVEKIT_API_KEY", "VAS_LIVEKIT_API_KEY"),
    )
    livekit_api_secret: str = Field(
        "",
        validation_alias=AliasChoices("LIVEKIT_API_SECRET", "VAS_LIVEKIT_API_SECRET"),
    )

    gcs_bucket_name: str = "local-recordings"
    # Points at fake-gcs locally. Non-empty also switches signed URLs to direct ones,
    # because fake-gcs has no credentials to sign with.
    gcs_endpoint_override: str = ""

    service_bearer_token: str = ""
    callback_signing_secret: str = ""
    main_backend_callback_url: str = ""

    signed_url_expiry_minutes: int = 240
    recording_retention_days: int = 90
    # LiveKit signs its webhooks and stamps them; anything older is a replay.
    webhook_max_age_seconds: int = 300

    temporal_address: str = "localhost:7233"
    temporal_task_queue: str = "vas"

    model_config = {"env_prefix": "VAS_"}


settings = Settings()
