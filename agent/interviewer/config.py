"""Settings for the interviewer agent.

Loaded from backend/.env by default, because every value here has a counterpart there --
the agent's bearer token is core's INTERVIEW_AGENT_BEARER_TOKEN, and its LiveKit
credentials are the ones tps signs join tokens with. Two files would be two chances for
them to disagree.

No field is required: the worker must be able to start and say what is missing, rather
than fail to import.
"""

from pathlib import Path

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings

_BACKEND_ENV = Path(__file__).resolve().parents[2] / "backend" / ".env"


class Settings(BaseSettings):
    # Where core lives. Not the frontend -- there is no /api prefix outside the Next proxy.
    core_base_url: str = "http://localhost:8000"
    # Must match core's INTERVIEW_AGENT_BEARER_TOKEN.
    agent_bearer_token: str = ""
    core_timeout_seconds: float = 10.0

    # Must match core's INTERVIEW_AGENT_NAME, or the join token dispatches a name no
    # worker answers to and the candidate sits alone in the room.
    agent_name: str = "interviewer"

    model: str = "claude-sonnet-4-5"
    # The backend's own key, under the backend's own name -- the agent shares core's
    # Anthropic account, and a second variable for the same secret is a second thing to
    # rotate. ANTHROPIC_API_KEY is accepted too, because that is what the plugin's own
    # documentation tells people to set.
    anthropic_api_key: str = Field(
        "", validation_alias=AliasChoices("AI_ANTHROPIC_API_KEY", "ANTHROPIC_API_KEY")
    )
    # Cartesia's voice id. Swappable without touching code because the right voice is a
    # judgement about the product, not about the agent.
    voice_id: str = "6f84f4b8-58a2-430c-8c79-688dad597532"

    model_config = {
        "env_file": str(_BACKEND_ENV),
        "env_file_encoding": "utf-8",
        "env_prefix": "INTERVIEW_",
        "extra": "ignore",
    }


settings = Settings()
