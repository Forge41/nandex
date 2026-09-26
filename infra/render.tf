# Three services, down from the nine processes dev_serve.sh runs:
#
#   core     core ASGI + tps gRPC in one container. The gRPC port is never published;
#            core reaches tps over loopback, which keeps the import boundary in
#            AGENTS.md intact -- that rule is about imports, not processes.
#   worker   one Temporal worker registered on all four task queues.
#   agent    the LiveKit interviewer.
#
# Every one of them needs a Dockerfile that does not exist in this repo yet. See
# .claude/plans/docs/terraform.md -- these paths are the contract, not a discovery.

resource "render_web_service" "core" {
  name   = "nandex-core"
  plan   = var.web_plan
  region = var.render_region

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = var.branch
      dockerfile_path = "./deploy/Dockerfile.core"
      auto_deploy     = true
    }
  }

  health_check_path = "/health"

  # Migrations run here rather than in a CI job: Render blocks the deploy until this
  # exits zero, so a failed migration never becomes a running container against a
  # schema it does not match. A CI job cannot offer that ordering.
  pre_deploy_command = "uv run manage.py migrate --noinput"

  # Only values that are not secrets. Every credential is set once in the Render
  # dashboard and deliberately left out of here, because anything Terraform sets it
  # also stores -- and state is readable by anyone who can read the workspace.
  env_vars = {
    DJANGO_DEBUG                  = { value = "false" }
    INTERVIEW_RECORDING_ENABLED   = { value = "false" }
    INTERVIEW_TEMPORAL_TASK_QUEUE = { value = "interview" }
  }
}

resource "render_background_worker" "temporal" {
  name   = "nandex-worker"
  plan   = var.worker_plan
  region = var.render_region

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = var.branch
      dockerfile_path = "./deploy/Dockerfile.worker"
      auto_deploy     = true
    }
  }

  env_vars = {
    DJANGO_DEBUG                = { value = "false" }
    INTERVIEW_RECORDING_ENABLED = { value = "false" }
  }
}

resource "render_background_worker" "agent" {
  name   = "nandex-agent"
  plan   = var.agent_plan
  region = var.render_region

  runtime_source = {
    docker = {
      repo_url        = var.repo_url
      branch          = var.branch
      dockerfile_path = "./deploy/Dockerfile.agent"
      auto_deploy     = true
    }
  }

  env_vars = {
    # `url` is already absolute; prefixing a scheme would produce https://https://...
    INTERVIEW_CORE_BASE_URL = { value = render_web_service.core.url }
  }
}
