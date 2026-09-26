#!/usr/bin/env bash
# Runs tps's gRPC server alongside the ASGI app, and makes either one dying kill the
# container. Render restarts it; a container still answering HTTP while core's only
# route to tps is gone would serve requests that cannot mint a room token.
set -euo pipefail

python manage.py rungrpc &
grpc_pid=$!

# Render supplies PORT. The default matches the local stack so the image behaves the
# same way outside Render.
uvicorn config.asgi:application --host 0.0.0.0 --port "${PORT:-8000}" &
asgi_pid=$!

trap 'kill -TERM "$grpc_pid" "$asgi_pid" 2>/dev/null || true' EXIT INT TERM

# Whichever exits first decides the container's fate.
wait -n "$grpc_pid" "$asgi_pid"
