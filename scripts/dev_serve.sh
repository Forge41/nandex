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
RUNNER_PORT=8002
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

# A warning, not an error: without LiveKit there is no room and no interviewer, but the
# upload, the plan and every other screen work perfectly well. `make up` starts these.
if ! nc -z localhost 7880 2>/dev/null; then
    echo "warning: nothing is listening on :7880 -- LiveKit isn't running, so no room can" >&2
    echo "         be joined and the interviewer can't connect. Start it with 'make vas-stack'" >&2
    echo "         (or use 'make up', which does it for you)." >&2
fi

# ---------------------------------------------------------------------------
# Clean up anything left bound to our ports from a previous crashed run
# ---------------------------------------------------------------------------

for port in "$HTTP_PORT" "$VAS_PORT" "$RUNNER_PORT" "$GRPC_PORT" "$FRONTEND_PORT"; do
    lsof -ti ":$port" 2>/dev/null | xargs kill -9 2>/dev/null || true
done

# ---------------------------------------------------------------------------
# Start (or reuse) a local Temporal dev server, and wait for it to be healthy
# before starting anything that depends on it
# ---------------------------------------------------------------------------

if nc -z localhost "$TEMPORAL_PORT" 2>/dev/null; then
    echo "Reusing an already-running Temporal dev server on :$TEMPORAL_PORT."
    echo "  (this one outlives Ctrl-C, because this script did not start it -- 'make temporal-down' stops it)"
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
# Loopback only, deliberately: this is the one process that can start containers on the
# host, and publishing it would put that behind a single leaked token.
(cd backend && uv run uvicorn config.runner_asgi:application --host 127.0.0.1 --port 8002 --reload; kill 0) &
# Deliberately not `kill 0`, unlike every line above it. The workers share the stack's
# fate because a silently dead worker leaves work queued and nothing to run it. The
# interviewer is different: without it a candidate gets no interviewer and everything
# else -- upload, plan, room, recording -- still works. Taking the frontend and the API
# down because the voice agent cannot reach LiveKit is the worse failure.
(cd agent && uv run python -m interviewer.main dev; \
    echo "!! the interviewer agent stopped. Everything else is still running.") &
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
printf "│  %-16s →  %-39s│\n" "Frontend" "http://localhost:$FRONTEND_PORT"
printf "│  %-16s →  %-39s│\n" "Backend API" "http://localhost:$HTTP_PORT"
printf "│  %-16s →  %-39s│\n" "vas (video)" "http://localhost:$VAS_PORT"
printf "│  %-16s →  %-39s│\n" "tps gRPC" "localhost:$GRPC_PORT"
printf "│  %-16s →  %-39s│\n" "Temporal UI" "http://localhost:$TEMPORAL_UI_PORT"
printf "│  %-16s →  %-39s│\n" "Temporal gRPC" "localhost:$TEMPORAL_PORT"
printf "│  %-16s →  %-39s│\n" "importer worker" "(no port -- task queue \"importer\")"
printf "│  %-16s →  %-39s│\n" "ingest worker" "(no port -- task queue \"ingest\")"
printf "│  %-16s →  %-39s│\n" "vas worker" "(no port -- task queue \"vas\")"
printf "│  %-16s →  %-39s│\n" "interview worker" "(no port -- task queue \"interview\")"
printf "│  %-16s →  %-39s│\n" "interviewer" "(no port -- LiveKit agent \"interviewer\")"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""

wait
