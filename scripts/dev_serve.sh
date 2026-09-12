#!/usr/bin/env bash
# dev_serve.sh -- starts the whole local nandex stack for `make serve-all`: a local Temporal
# dev server (reused if one is already running), the backend under a real ASGI server, tps's
# gRPC server, the vas process on its own port, every Temporal worker, and the frontend dev
# server.
#
# Every process this script starts shares one process group. `trap ... kill 0` tears the whole
# group down together on Ctrl-C, and each service re-triggers that same cleanup the instant IT
# exits -- a crash in one (say, a worker that lost its Temporal connection) shouldn't leave the
# rest quietly running half-broken. A Temporal server this script *reused* rather than started
# lives in its own, different process group, so it's correctly left running either way.

set -uo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HTTP_PORT=8000
VAS_PORT=8001
GRPC_PORT=50051
FRONTEND_PORT=3000
TEMPORAL_PORT=7233

trap 'kill 0' EXIT INT TERM

# ---------------------------------------------------------------------------
# Preflight -- fail fast with a clear message instead of a stack trace later
# ---------------------------------------------------------------------------

if command -v pg_isready >/dev/null 2>&1 && ! pg_isready -h localhost -q; then
    echo "error: can't reach a local Postgres -- see README Setup." >&2
    exit 1
fi

if [ ! -f backend/.env ]; then
    echo "error: backend/.env is missing -- see README Setup (cp backend/.env.example backend/.env)." >&2
    exit 1
fi

if [ ! -f frontend/.env ] || [ ! -d frontend/node_modules ]; then
    echo "error: frontend isn't set up -- see README Setup (cd frontend && pnpm install && cp .env.example .env)." >&2
    exit 1
fi

if ! command -v temporal >/dev/null 2>&1; then
    echo "error: the 'temporal' CLI isn't installed -- see README Setup (brew install temporal)." >&2
    exit 1
fi

# ---------------------------------------------------------------------------
# Clean up anything left bound to our ports from a previous crashed run
# ---------------------------------------------------------------------------

for port in "$HTTP_PORT" "$VAS_PORT" "$GRPC_PORT" "$FRONTEND_PORT"; do
    lsof -ti ":$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done

# ---------------------------------------------------------------------------
# Start (or reuse) a local Temporal dev server, and wait for it to be healthy
# before starting anything that depends on it
# ---------------------------------------------------------------------------

if nc -z localhost "$TEMPORAL_PORT" 2>/dev/null; then
    echo "Reusing an already-running Temporal dev server on :$TEMPORAL_PORT."
else
    echo "Starting a local Temporal dev server..."
    temporal server start-dev > /tmp/nandex-temporal-dev.log 2>&1 &
    for _ in $(seq 1 30); do
        nc -z localhost "$TEMPORAL_PORT" 2>/dev/null && break
        sleep 1
    done
    if ! nc -z localhost "$TEMPORAL_PORT" 2>/dev/null; then
        echo "error: Temporal dev server didn't come up -- see /tmp/nandex-temporal-dev.log" >&2
        exit 1
    fi
fi

# ---------------------------------------------------------------------------
# The vas process binds all interfaces because LiveKit and Egress run as containers and
# reach it by the host gateway; a loopback-only listener is unreachable from there.
#
# Start every other service. Each kills the whole group the moment it exits,
# whether that's a clean stop or a crash -- see the trap note up top.
# ---------------------------------------------------------------------------

(cd backend && uv run uvicorn config.asgi:application --reload; kill 0) &
(cd backend && uv run manage.py rungrpc; kill 0) &
(cd backend && uv run uvicorn config.vas_asgi:application --host 0.0.0.0 --port "$VAS_PORT" --reload; kill 0) &
(cd backend && uv run manage.py run_vas_worker; kill 0) &
(cd backend && uv run manage.py run_importer_worker; kill 0) &
(cd backend && uv run manage.py run_ingest_worker; kill 0) &
(cd backend && uv run manage.py run_interview_worker; kill 0) &
(cd frontend && pnpm dev; kill 0) &

# ---------------------------------------------------------------------------
# Wait for the two HTTP-facing services to actually accept connections, then
# print exactly what's running and where -- `make serve-all` should answer
# "what ports, which services" on its own, not send you digging through logs.
# ---------------------------------------------------------------------------

for _ in $(seq 1 30); do
    nc -z localhost "$HTTP_PORT" 2>/dev/null && nc -z localhost "$FRONTEND_PORT" 2>/dev/null && break
    sleep 1
done

TEMPORAL_UI_PORT=$((TEMPORAL_PORT + 1000))

echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│                   nandex -- all systems go                  │"
echo "├─────────────────────────────────────────────────────────────┤"
printf "│  %-15s →  %-40s│\n" "Frontend" "http://localhost:$FRONTEND_PORT"
printf "│  %-15s →  %-40s│\n" "Backend API" "http://localhost:$HTTP_PORT"
printf "│  %-15s →  %-40s│\n" "vas (video)" "http://localhost:$VAS_PORT"
printf "│  %-15s →  %-40s│\n" "tps gRPC" "localhost:$GRPC_PORT"
printf "│  %-15s →  %-40s│\n" "Temporal UI" "http://localhost:$TEMPORAL_UI_PORT"
printf "│  %-15s →  %-40s│\n" "Temporal gRPC" "localhost:$TEMPORAL_PORT"
printf "│  %-15s →  %-40s│\n" "importer worker" "(no port -- task queue \"importer\")"
printf "│  %-15s →  %-40s│\n" "ingest worker" "(no port -- task queue \"ingest\")"
printf "│  %-15s →  %-40s│\n" "vas worker" "(no port -- task queue \"vas\")"
printf "│  %-15s →  %-40s│\n" "interview worker" "(no port -- task queue \"interview\")"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

wait
