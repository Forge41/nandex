"""Isolate vocals (demucs), then slice/trim/resample via RVC's own train/preprocess.py.

Output lands in vendor/rvc/logs/<voice_name>/ -- RVC's own downstream scripts
(extract_f0.py, extract_hubert_feature.py, train.py) all expect that path by convention,
so it's left there rather than mirrored into data/processed/.
"""

import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import DATA_DIR, RVC_ROOT


AUDIO_EXTENSIONS = {".wav", ".flac", ".mp3", ".m4a", ".ogg"}


def isolate_vocals(voice_name: str) -> Path:
    raw_dir = DATA_DIR / "raw" / voice_name
    isolated_dir = DATA_DIR / "isolated" / voice_name
    isolated_dir.mkdir(parents=True, exist_ok=True)

    inputs = sorted(p for p in raw_dir.iterdir() if p.suffix.lower() in AUDIO_EXTENSIONS)
    if not inputs:
        raise FileNotFoundError(f"No audio files in {raw_dir}")

    # demucs's CLI takes explicit file args, not a directory.
    subprocess.run(
        [sys.executable, "-m", "demucs", "--two-stems", "vocals", "-o", str(isolated_dir), *map(str, inputs)],
        check=True,
    )
    # demucs writes <isolated_dir>/<model_name>/<track>/vocals.wav per input file --
    # flatten those into isolated_dir itself, named after the source file.
    for vocals_path in isolated_dir.rglob("vocals.wav"):
        target = isolated_dir / f"{vocals_path.parent.name}.wav"
        shutil.move(str(vocals_path), str(target))
    for leftover in isolated_dir.iterdir():
        if leftover.is_dir():
            shutil.rmtree(leftover)
    return isolated_dir


def preprocess_voice(voice_name: str, sample_rate: int = 40000, slice_seconds: float = 3.7) -> Path:
    isolated_dir = isolate_vocals(voice_name)
    exp_dir = RVC_ROOT / "logs" / voice_name
    exp_dir.mkdir(parents=True, exist_ok=True)  # train/preprocess.py appends to exp_dir/preprocess.log on import

    subprocess.run(
        [
            sys.executable,
            "train/preprocess.py",
            str(isolated_dir),
            str(sample_rate),
            "1",  # n_p: preprocessing worker count
            str(exp_dir),
            "False",  # noparallel
            str(slice_seconds),
        ],
        cwd=RVC_ROOT,
        check=True,
    )
    return exp_dir
