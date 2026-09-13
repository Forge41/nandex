.DEFAULT_GOAL := help
.PHONY: help install hooks agent-permissions link-agents fmt lint lint-ci test check \
	up down doctor check-speech serve-all temporal temporal-down tps tps-migrate tps-grpc grpc-gen migrate importer-migrate \
	ingest-migrate importer-worker ingest-worker interview-worker interviewer-agent \
	vas vas-worker vas-stack vas-stack-down asgi frontend runner runner-images

help: ## List available targets
	@grep -hE '^[a-z][a-zA-Z0-9_-]*:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

install: ## Install dependencies and git hooks
	uv sync --all-groups
	cd agent && uv sync --all-groups
	cd frontend && pnpm install
	$(MAKE) link-agents
	$(MAKE) hooks

hooks: ## (Re)install git hooks
	uv run pre-commit install --hook-type pre-commit --hook-type commit-msg --hook-type pre-push

link-agents: ## Point each tool's config dir at the shared .agents/ tree
	ln -sfn ../.agents/skills .claude/skills
	ln -sfn ../.agents/subagents .claude/agents
	ln -sfn ../.agents/skills .codex/skills
	ln -sfn ../.agents/skills .cursor/skills
	uv run python scripts/validate_agent_assets.py

agent-permissions: ## Regenerate per-tool permission configs from .agents/permissions.toml
	uv run python scripts/gen_agent_permissions.py

# ---------------------------------------------------------------------------
# Running it
# ---------------------------------------------------------------------------

up: ## Everything, from nothing: containers, migrations, then every service
	@$(MAKE) --no-print-directory doctor
	@echo ""
	$(MAKE) vas-stack
	$(MAKE) runner-images
	$(MAKE) migrate
	$(MAKE) serve-all

down: ## Stop what `up` started: the containers and the Temporal dev server
	$(MAKE) vas-stack-down
	$(MAKE) temporal-down

temporal: ## Run the local Temporal dev server in the foreground (Ctrl-C stops it)
	temporal server start-dev

temporal-down: ## Stop a local Temporal dev server, whoever started it
	@# start-dev keeps its history in memory, so this discards it -- which is why it is a
	@# target you have to ask for rather than something serve-all does on the way out.
	@pkill -f 'temporal server start-dev' \
		&& echo "Stopped the Temporal dev server (its workflow history was in memory and is gone)." \
		|| echo "No Temporal dev server was running."

doctor: ## Say what backend/.env is missing, and what stops working without it
	@uv run python scripts/check_env.py

check-speech: ## Ask Deepgram and Cartesia whether the keys in .env actually work
	@uv run python scripts/check_speech.py

# ---------------------------------------------------------------------------
# Backend services
# ---------------------------------------------------------------------------

serve-all: ## Every service, assuming containers and migrations are already done (see `up`)
	bash scripts/dev_serve.sh

tps: ## Run the Django dev server under WSGI -- only reliable for tps's own HTTP API (see README)
	cd backend && uv run manage.py runserver

tps-migrate: ## Apply pending database migrations for the tps app
	cd backend && uv run manage.py migrate tps

tps-grpc: ## Run tps's gRPC server (core talks to tps only via this, never HTTP)
	cd backend && uv run manage.py rungrpc

migrate: ## Apply pending database migrations for every app
	cd backend && uv run manage.py migrate

importer-migrate: ## Apply pending database migrations for the importer app
	cd backend && uv run manage.py migrate importer

ingest-migrate: ## Apply pending database migrations for the ingest app
	cd backend && uv run manage.py migrate ingest

importer-worker: ## Run importer's Temporal worker (needs a Temporal server already running)
	cd backend && uv run manage.py run_importer_worker

vas-stack: ## Start the containers vas needs locally: LiveKit, Egress, fake-GCS, Redis
	@test -f dev/gcs-fake-credentials.json || (cd backend && uv run python ../scripts/gen_fake_gcs_credentials.py)
	docker compose -f dev/docker-compose.yml up -d
	@echo "Waiting for the recordings bucket in fake-gcs..."
	@# Checked before created, because fake-gcs keeps its volume across `down` and answers
	@# 409 for a bucket that is already there -- which curl -f reads as failure, so
	@# creating first looped forever on every run after the first.
	@until curl -sf -o /dev/null 'http://localhost:4443/storage/v1/b/local-recordings' \
		|| curl -sf -o /dev/null -X POST 'http://localhost:4443/storage/v1/b?project=local-dev' \
			-H 'Content-Type: application/json' -d '{"name":"local-recordings"}'; do sleep 1; done
	@echo "LiveKit ws://localhost:7880 | fake-GCS http://localhost:4443"

vas-stack-down: ## Stop and remove the local vas containers
	docker compose -f dev/docker-compose.yml down

vas: ## Run the vas process (recording/storage) on its own port -- separate deployable, same DB
	cd backend && uv run uvicorn config.vas_asgi:application --host 0.0.0.0 --port 8001 --reload

vas-worker: ## Run vas's Temporal worker (needs a Temporal server already running)
	cd backend && uv run manage.py run_vas_worker

ingest-worker: ## Run ingest's Temporal worker (needs a Temporal server already running)
	cd backend && uv run manage.py run_ingest_worker

interview-worker: ## Run interview's Temporal worker -- reads resumes and writes the plan
	cd backend && uv run manage.py run_interview_worker

interviewer-agent: ## Run the LiveKit agent that joins the room and talks to the candidate
	cd agent && uv run python -m interviewer.main dev

asgi: ## Run the full API under a real ASGI server (needed for core/chat/marketplace to work)
	cd backend && uv run uvicorn config.asgi:application --reload

frontend: ## Run the Next.js dev server (proxies /api/* to the backend -- see frontend/.env)
	cd frontend && pnpm dev

grpc-gen: ## Regenerate apps/tps/grpc/tps_pb2*.py from tps.proto
	cd backend && uv run python -m grpc_tools.protoc \
		-I apps/tps/grpc \
		--python_out=apps/tps/grpc \
		--grpc_python_out=apps/tps/grpc \
		--pyi_out=apps/tps/grpc \
		apps/tps/grpc/tps.proto
	cd backend && sed -i.bak 's/^import tps_pb2 as tps__pb2$$/from . import tps_pb2 as tps__pb2/' \
		apps/tps/grpc/tps_pb2_grpc.py && rm apps/tps/grpc/tps_pb2_grpc.py.bak

# ---------------------------------------------------------------------------
# Quality
# ---------------------------------------------------------------------------

fmt: ## Format and autofix
	uv run ruff check --fix .
	uv run ruff format .

lint: ## Run the fast commit hooks against the whole tree
	uv run pre-commit run --all-files

lint-ci: ## Everything lint does, plus the slow manual-stage hooks
	uv run pre-commit run --all-files --verbose
	uv run pre-commit run --all-files --hook-stage manual --verbose

test: ## Run the backend test suite
	cd backend && uv run pytest

check: fmt lint test ## Format, lint, and test

runner: ## Run the code-execution sandbox service (needs Docker; loopback only)
	cd backend && uv run uvicorn config.runner_asgi:application --host 127.0.0.1 --port 8002 --reload

runner-images: ## Build the four sandbox images (python, java, c/c++, sql)
	@cp backend/apps/runner/harness/harness.py dev/runner/harness.py
	docker build -f dev/runner/Dockerfile.python -t nandex-runner-python:latest dev/runner
	docker build -f dev/runner/Dockerfile.java   -t nandex-runner-java:latest   dev/runner
	docker build -f dev/runner/Dockerfile.cpp    -t nandex-runner-cpp:latest    dev/runner
	docker build -f dev/runner/Dockerfile.sql    -t nandex-runner-sql:latest    dev/runner
