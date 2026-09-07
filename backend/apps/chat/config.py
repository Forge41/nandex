from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    default_top_k: int = 8

    model_config = {"env_prefix": "CHAT_"}


settings = Settings()
