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

    model_config = {"env_prefix": "IMPORTER_"}


settings = Settings()
