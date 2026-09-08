#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -d vendor/rvc ] || [ -z "$(ls -A vendor/rvc 2>/dev/null)" ]; then
    echo "vendor/rvc is empty -- run: git submodule update --init vendor/rvc" >&2
    exit 1
fi

# Pending vendor/rvc: base models (HuBERT/ContentVec, rmvpe pitch extractor) are fetched
# by RVC's own tools/download_models.py once the submodule is in place.
echo "TODO: invoke vendor/rvc's tools/download_models.py to populate pretrained/" >&2
exit 1
