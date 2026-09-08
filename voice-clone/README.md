# voice-clone

Standalone voice-conversion tooling (RVC-based). No coupling to `backend/`'s Django apps or
`frontend/` — own deps, own venv.

## Layout

```
data/
  raw/        source audio clips, untouched
  isolated/   vocals-only, post background-removal
  processed/  sliced/resampled/trimmed, training-ready
models/       trained weights (model.pth + model.index) per voice, committed
pretrained/   third-party base models RVC training depends on (HuBERT/ContentVec, pitch extractors)
training/     preprocess -> extract_features -> train
inference/    convert.py (core conversion), realtime.py, api.py (FastAPI wrapper)
vendor/rvc/   RVC-Project core, vendored as a pinned git submodule
```

`data/`, `pretrained/`, and `vendor/rvc/` are gitignored — source audio and third-party
downloads don't belong in this repo's history. `models/` is committed directly (no Git LFS);
each retrain grows repo history by the full weight size.

## Setup

```bash
cd voice-clone
./scripts/setup_env.sh
git submodule update --init vendor/rvc
./scripts/download_pretrained.sh
```

## Workflow

1. Drop source clips in `data/raw/<voice_name>/`.
2. `training/preprocess.py` — isolate vocals, slice, resample, trim silence into `data/processed/<voice_name>/`.
3. `training/extract_features.py` — content + pitch features for the processed set.
4. `training/train.py` — train, writes `models/<voice_name>/model.{pth,index}`.
5. `inference/convert.py` — convert any input audio into `<voice_name>`.
6. `inference/api.py` — serve `convert()` over HTTP for application integration.
