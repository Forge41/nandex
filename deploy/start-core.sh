#!/usr/bin/env bash
# Runs tps's gRPC server alongside the ASGI app, and makes either one dying kill the
# container. Render restarts it; a container still answering HTTP while core's only
# route to tps is gone would serve requests that cannot mint a room token.
set -euo pipefail

# Migrations run here rather than in Render's pre_deploy_command, which is a paid-plan
# feature: Render accepts the field on a free service and silently drops it, so on the
# free plan nothing would ever migrate. Doing it here works on every plan.
#
# The cost of moving it: a failed migration crash-loops the container instead of
# blocking the deploy. Render keeps the previous version serving until the new one is
# healthy, so what a candidate sees is the same either way.
python manage.py migrate --noinput

python manage.py rungrpc &
grpc_pid=$!

# Render supplies PORT. The default matches the local stack so the image behaves the
# same way outside Render.
uvicorn config.asgi:application --host 0.0.0.0 --port "${PORT:-8000}" &
asgi_pid=$!

trap 'kill -TERM "$grpc_pid" "$asgi_pid" 2>/dev/null || true' EXIT INT TERM

# Whichever exits first decides the container's fate.
wait -n "$grpc_pid" "$asgi_pid"
