"""Config for reaching tps over gRPC — deliberately its own config, not a shared one and
not apps.core's. importer depends on tps directly, not on core, so it needs its own
address/secret the same way core has its own.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tps_grpc_address: str = "localhost:50051"
    tps_secret: str = "dev-tps-secret-change-in-production"

    temporal_address: str = "localhost:7233"
    temporal_task_queue: str = "importer"
    sweep_interval_seconds: int = 90

    max_upload_bytes: int = 20 * 1024 * 1024
    # Mirrors apps.ingest.config.Settings.temporal_task_queue's default exactly -- importer
    # must not import apps.ingest (same direction rule as ALLOWED_UPLOAD_CONTENT_TYPES), so
    # this is kept in sync by hand. Used only to start IngesterWorkflow by name for an
    # uploaded document; ingest's own sweep is what actually picks up everything else.
    ingest_task_queue: str = "ingest"

    model_config = {"env_prefix": "IMPORTER_"}


settings = Settings()
