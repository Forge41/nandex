"""Runner configuration.

The bind address is deliberately absent from here: it is a `make`/`dev_serve.sh` concern
and defaults to loopback there. Anything reaching this process with the bearer token can
start containers on the host that holds the Docker socket, which is a worse outcome than
the same mistake against vas -- so it is never published off the host.
"""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    service_bearer_token: str = ""

    # Docker's own default when unset, which is the unix socket on this host.
    docker_host: str = ""

    # How many containers may run at once. Beyond this, callers are refused with 429
    # rather than queued into a timeout: a run that waited is reported to the candidate
    # as their own code being slow, which is a lie about their solution.
    max_concurrent_runs: int = 4

    # Bytes of terminal output carried back before truncation. A `while True: print()`
    # must not be able to fill the response.
    max_output_bytes: int = 256_000
    max_output_lines: int = 2000

    # Total ceiling regardless of what a caller asks for, so a compromised or buggy core
    # cannot hold a container open indefinitely.
    max_budget_ms: int = 120_000

    model_config = {"env_prefix": "RUNNER_"}


settings = Settings()
