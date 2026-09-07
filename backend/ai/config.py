from pydantic_settings import BaseSettings


class AISettings(BaseSettings):
    anthropic_api_key: str = ""
    default_model: str = "claude-sonnet-4-5"

    model_config = {"env_prefix": "AI_"}


settings = AISettings()
