"""interview app configuration.

No field is required: settings is constructed at import time, which happens during
django.setup(), so a required field would break manage.py for anyone without the video
stack configured.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # The agent worker registers under this name; the token's roomConfig.agents claim
    # dispatches it by the same string. They must match or nobody joins the room.
    agent_name: str = "interviewer"
    # Long enough to survive a slow first connect, short enough that a leaked token
    # expires. The browser re-fetches off the JWT's own exp, not this number.
    join_token_ttl_seconds: int = 900

    plan_model: str = "claude-sonnet-4-5"

    # The interviewer agent runs as its own process with no candidate cookie, so it
    # presents this to read a session's brief and append transcript turns. Empty rejects
    # every agent request rather than accepting any.
    agent_bearer_token: str = ""

    # Candidate source and terminal output are candidate data, retained on the same
    # clock as their recording so "delete this candidate" has one answer.
    code_retention_days: int = 90
    run_terminal_lines: int = 400

    temporal_address: str = "localhost:7233"
    # Mirrors nothing else -- this app owns its own queue. No worker ships yet; the
    # trigger is fire-and-forget so a missing worker is a logged gap, not a failure.
    temporal_task_queue: str = "interview"

    model_config = {"env_prefix": "INTERVIEW_"}


settings = Settings()
