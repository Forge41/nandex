# voice-clone

Standalone voice-conversion tooling (RVC-based). No coupling to `backend/`'s Django apps or
`frontend/` — own deps, own venv.

## Layout

```
data/
  raw/        source audio clips, untouched
  isolated/   vocals-only, post background-removal (demucs output)
models/       trained weights (model.pth + model.index) per voice, committed
training/     preprocess -> extract_features -> train
inference/    convert.py (core conversion), realtime.py, api.py (FastAPI wrapper)
vendor/rvc/   RVC-Project core, vendored as a pinned git submodule
paths.py      shared path constants used by training/ and inference/
```

`data/` is gitignored — source audio doesn't belong in this repo's history. `models/` is
committed directly (no Git LFS); each retrain grows repo history by the full weight size.
Pretrained base models (HuBERT, rmvpe, RVC's own pretrained_v2 checkpoints) and RVC's own
`logs/`/`assets/` working directories live inside `vendor/rvc/` — that's a separate git
repository (the submodule), so downloads there never touch this repo's history either.

## Setup

```bash
cd voice-clone
./scripts/setup_env.sh
git submodule update --init vendor/rvc
./scripts/download_pretrained.sh
```

## Workflow

1. Drop source clips in `data/raw/<voice_name>/`.
2. `training.preprocess.preprocess_voice(voice_name)` — isolates vocals (demucs) into
   `data/isolated/<voice_name>/`, then slices/resamples/trims via RVC's own
   `train/preprocess.py` into `vendor/rvc/logs/<voice_name>/`.
3. `training.extract_features.extract_features(voice_name)` — pitch (rmvpe) + content
   (HuBERT v2) features over that same experiment dir.
4. `training.train.train(voice_name)` — generates `config.json`/`filelist.txt`, trains via
   RVC's `train/train.py`, builds the retrieval index via `train/train_index.py`, then
   copies the result into `models/<voice_name>/model.{pth,index}`.
5. `inference.convert.convert(input_path, voice_name)` — shells out to RVC's `infer/cli.py`
   to convert any input audio into `<voice_name>`.
6. `inference/api.py` (FastAPI) — `POST /convert/{voice_name}` serves `convert()` over HTTP.
7. `inference.realtime.run_realtime()` — RVC only exposes real-time conversion as a desktop
   GUI (`realtime_gui.py`, Tkinter + sounddevice); this launches that directly rather than
   faking a headless API RVC doesn't have.

Everything here trains a single-speaker model per voice (`models/<voice_name>/`) at 40k
sample rate, v2 features, f0-enabled — RVC's own multi-speaker mode and other sample
rates/versions aren't wired up.

One real quirk worth knowing: RVC has no `configs/v2/40k.json` -- 40k models always reuse the
v1 architecture config (`configs/v1/40k.json`) regardless of feature version; only 32k/48k
have distinct v2 configs. `training/train.py` accounts for this already.
