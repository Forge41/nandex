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
# requirments_cpu_py312.txt pins torch/torchaudio/torchvision==*+cpu from a Linux/Windows-only
# wheel index -- no macOS build exists for that variant, so on Mac we keep the plain-PyPI
# torch/torchaudio pyproject.toml already installed and skip RVC's own pins for those three.
if [[ "$(uname)" == "Darwin" ]]; then
    grep -vE '^torch(audio|vision)?==.*\+cpu|^torch-directml' vendor/rvc/requirments_cpu_py312.txt \
        > /tmp/voice-clone-rvc-requirements.txt
    uv pip install -r /tmp/voice-clone-rvc-requirements.txt
    rm /tmp/voice-clone-rvc-requirements.txt
else
    uv pip install -r vendor/rvc/requirments_cpu_py312.txt
fi

# gradio (an RVC dependency, used only by webui.py -- which this project never runs)
# downgrades websockets to a version incompatible with our pinned uvicorn.
uv pip install "websockets>=13"
