from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings

# parents[3] is the repository root locally and /app in the core image, which copies the
# corpus to the same relative place.
_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    project_id: str = "portfolio"
    corpus_dir: Path = _REPO_ROOT / "portfolio" / "content" / "sources"

    model: str = "claude-haiku-4-5"
    max_output_tokens: int = 600
    top_k: int = 6
    max_question_chars: int = 2000
    max_jd_chars: int = 6000

    per_ip_per_minute: int = 10
    per_ip_per_day: int = 50
    # Across every visitor. Past it, ask and fit answer 503 and the page falls back to its
    # offline matcher, so a scripted flood costs at most this many model calls a day.
    daily_request_cap: int = 1000
    messages_per_ip_per_hour: int = 5

    # Voice runs the same LiveKit worker as the interview room, dispatched in portfolio
    # mode. Off until that worker is deployed: a token for a room no agent joins is a
    # visitor talking to silence.
    voice_enabled: bool = False
    voice_token_ttl_seconds: int = 600
    voice_max_minutes: int = 5
    voice_sessions_per_ip_per_day: int = 3
    # The worker's own name and token, under the interview app's variables, so one worker
    # has one of each rather than a copy per surface that could drift.
    agent_name: str = Field(
        "interviewer", validation_alias=AliasChoices("PORTFOLIO_AGENT_NAME", "INTERVIEW_AGENT_NAME")
    )
    agent_bearer_token: str = Field(
        "",
        validation_alias=AliasChoices(
            "PORTFOLIO_AGENT_BEARER_TOKEN", "INTERVIEW_AGENT_BEARER_TOKEN"
        ),
    )

    owner_email: str = ""
    query_retention_days: int = 90

    model_config = {"env_prefix": "PORTFOLIO_"}


settings = Settings()
