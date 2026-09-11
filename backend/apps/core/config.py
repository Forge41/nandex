"""Config for reaching the services core orchestrates — deliberately not importing their
own config modules.

Even though tps runs in the same process today and vas shares this project, core knows
each only as an address plus a secret, the same way it would if they were genuinely
separate deployments.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    tps_grpc_address: str = "localhost:50051"
    tps_secret: str = "dev-tps-secret-change-in-production"

    temporal_address: str = "localhost:7233"
    # Mirrors apps.importer.config.Settings.temporal_task_queue's default exactly -- core
    # must not import apps.importer, so this is kept in sync by hand (same convention as
    # apps.importer's own ingest_task_queue). Used only to start ImportInitiatorWorkflow by
    # name for a newly-connected app -- nothing else triggers a sync for that connection.
    importer_task_queue: str = "importer"

    # vas runs as its own process on its own port. core is the only caller: there is no
    # browser path to it, so every recording action is orchestrated through here.
    vas_base_url: str = "http://localhost:8001"
    vas_service_bearer_token: str = ""
    # Must match VAS_CALLBACK_SIGNING_SECRET. Kept separate from the bearer token because
    # they travel in opposite directions -- one authenticates us to vas, the other
    # authenticates vas's callbacks to us.
    vas_callback_signing_secret: str = ""
    vas_timeout_seconds: float = 10.0

    model_config = {"env_prefix": "CORE_"}


settings = Settings()
