from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Bump alongside embedding_model_name/embedding_dimensions when either changes -- a
    # reprocess is a new IngestRun at a new version, never an in-place mutation.
    pipeline_version: int = 1
    embedding_model_name: str = "BAAI/bge-small-en-v1.5"
    embedding_dimensions: int = 384
    chunk_token_budget: int = 400
    words_per_token_estimate: float = 0.75  # ~1.3 tokens/word inverted; see chunkers/prose.py
    embed_batch_size: int = 64
    fastembed_cache_dir: str | None = None  # None -> fastembed's own default cache dir

    model_config = {"env_prefix": "INGEST_"}


settings = Settings()
