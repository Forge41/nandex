"""Config for reaching tps over gRPC — deliberately not importing apps.tps.config.

Even though both apps run in the same process today, core only knows tps as an address +
a shared secret, the same way it would if tps were a genuinely separate deployment.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tps_grpc_address: str = "localhost:50051"
    tps_secret: str = "dev-tps-secret-change-in-production"

    temporal_address: str = "localhost:7233"
    # Mirrors apps.importer.config.Settings.temporal_task_queue's default exactly -- core
    # must not import apps.importer, so this is kept in sync by hand (same convention as
    # apps.importer's own ingest_task_queue). Used only to start ImportInitiatorWorkflow by
    # name for a newly-connected app; importer's own sweep is what covers everything else.
    importer_task_queue: str = "importer"

    model_config = {"env_prefix": "CORE_"}


settings = Settings()
