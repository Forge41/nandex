from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    default_top_k: int = 10
    lane_overfetch_multiplier: int = 3
    lane_overfetch_cap: int = 300
    rrf_k: int = 60
    vector_lane_weight: float = 1.0
    fts_lane_weight: float = 1.0
    reranker_enabled: bool = True
    reranker_model_name: str = "Xenova/ms-marco-MiniLM-L-6-v2"
    reranker_candidate_cap: int = 75
    reranker_timeout_seconds: float = 5.0
    # None -> shares apps.ingest's fastembed cache dir, so CI only needs to cache one directory
    # for both the embedding and reranker model downloads.
    reranker_cache_dir: str | None = None
    max_chunks_per_source: int = 3

    model_config = {"env_prefix": "RETRIEVAL_"}


settings = Settings()
