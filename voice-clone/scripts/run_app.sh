#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

uv run uvicorn app.server:app --reload --port 8765
