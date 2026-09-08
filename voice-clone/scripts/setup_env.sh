#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

uv sync

# training/*.py and inference/*.py shell out to vendor/rvc's own scripts with
# sys.executable -- they run in *this* venv, so RVC's own deps must live here too.
if [ ! -f vendor/rvc/requirments_cpu_py312.txt ]; then
    echo "vendor/rvc is empty -- run: git submodule update --init vendor/rvc" >&2
    exit 1
fi
uv pip install -r vendor/rvc/requirments_cpu_py312.txt
