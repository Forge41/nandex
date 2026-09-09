#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
VENV_PYTHON="$(pwd)/.venv/bin/python"
cd vendor/rvc

if [ ! -f infer/cli.py ]; then
    echo "vendor/rvc is empty -- run: git submodule update --init voice-clone/vendor/rvc" >&2
    exit 1
fi

# uv venvs ship no pip, and "python" on PATH isn't the venv -- go through uv pip / the
# venv's own interpreter explicitly, same convention as setup_env.sh. Not --upgrade: RVC's
# own transformers pin requires huggingface_hub<1.0, so blindly upgrading breaks inference.
uv pip install --python "$VENV_PYTHON" "huggingface_hub>=0.26.0,<1.0" >/dev/null
HF="$(dirname "$VENV_PYTHON")/hf"

# hubert_base (content features) + rmvpe (pitch extraction): required for both
# training and inference.
"$HF" download lj1995/VoiceConversionWebUI --revision main \
    --include "hubert_base/*" --local-dir assets
"$HF" download lj1995/VoiceConversionWebUI rmvpe.pt --revision main \
    --local-dir assets/rmvpe

# pretrained_v2 (G/D warm-start checkpoints) + mute (silence padding rows the
# training filelist requires): required for training only.
"$HF" download lj1995/VoiceConversionWebUI --revision main \
    --include "pretrained_v2/*" --local-dir assets
"$HF" download lj1995/VoiceConversionWebUI mute.zip --revision main \
    --local-dir .model-downloads
"$VENV_PYTHON" -m zipfile -e .model-downloads/mute.zip logs
