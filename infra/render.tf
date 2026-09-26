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

# Free for 30 days, then it expires -- Render's free tier is a trial, not a plan.
# pgvector is available on Render Postgres and apps.ingest's migration creates the
# extension itself, so nothing here has to enable it.
resource "render_postgres" "main" {
  name    = "nandex-db"
  plan    = "free"
  region  = var.render_region
  version = "17"

  database_name = "nandex"
  database_user = "nandex"
}

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

  # Only values that are not secrets. Every credential is set once in the Render
  # dashboard and deliberately left out of here, because anything Terraform sets it
  # also stores -- and state is readable by anyone who can read the workspace.
  env_vars = {
    DJANGO_DEBUG = { value = "false" }
    # Empty is not a default, it is a refusal: with DEBUG off and no hosts allowed,
    # Django answers 400 to every request including Render's health check, which is
    # exactly how the first deploy to main failed.
    #
    # Listed rather than "*" so a poisoned Host header still cannot reach this app.
    # The names cover the public URL, the private-network service name and loopback;
    # a custom domain is added here, not by widening this to a wildcard.
    DJANGO_ALLOWED_HOSTS          = { value = ".onrender.com,nandex-core,localhost,127.0.0.1" }
    INTERVIEW_RECORDING_ENABLED   = { value = "false" }
    INTERVIEW_TEMPORAL_TASK_QUEUE = { value = "interview" }
    # Internal, so the database is never exposed to the public internet.
    DATABASE_URL = { value = render_postgres.main.connection_info.internal_connection_string }
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
    DATABASE_URL                = { value = render_postgres.main.connection_info.internal_connection_string }
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
