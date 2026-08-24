.DEFAULT_GOAL := help
.PHONY: help install hooks agent-permissions link-agents fmt lint lint-ci test check

help: ## List available targets
	@grep -hE '^[a-z][a-zA-Z0-9_-]*:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

install: ## Install dependencies and git hooks
	uv sync --all-groups
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

test: ## Run the test suite
	uv run pytest -n auto

check: fmt lint test ## Format, lint, and test
