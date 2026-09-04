"""Config for reaching tps over gRPC — deliberately not importing apps.tps.config.

Even though both apps run in the same process today, core only knows tps as an address +
a shared secret, the same way it would if tps were a genuinely separate deployment.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tps_grpc_address: str = "localhost:50051"
    tps_secret: str = "dev-tps-secret-change-in-production"

    model_config = {"env_prefix": "CORE_"}


settings = Settings()
