#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../vendor/rvc"

if [ ! -f infer/cli.py ]; then
    echo "vendor/rvc is empty -- run: git submodule update --init voice-clone/vendor/rvc" >&2
    exit 1
fi

python -m pip install --upgrade huggingface_hub >/dev/null

# hubert_base (content features) + rmvpe (pitch extraction): required for both
# training and inference.
hf download lj1995/VoiceConversionWebUI --revision main \
    --include "hubert_base/*" --local-dir assets
hf download lj1995/VoiceConversionWebUI rmvpe.pt --revision main \
    --local-dir assets/rmvpe

# pretrained_v2 (G/D warm-start checkpoints) + mute (silence padding rows the
# training filelist requires): required for training only.
hf download lj1995/VoiceConversionWebUI --revision main \
    --include "pretrained_v2/*" --local-dir assets
hf download lj1995/VoiceConversionWebUI mute.zip --revision main \
    --local-dir .model-downloads
python -m zipfile -e .model-downloads/mute.zip logs
