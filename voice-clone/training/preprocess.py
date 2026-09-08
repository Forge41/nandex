"""Isolate vocals, slice, resample, and trim silence: data/raw/<voice> -> data/processed/<voice>."""

from pathlib import Path


def preprocess_voice(voice_name: str, raw_dir: Path, processed_dir: Path, sample_rate: int = 40000) -> None:
    # Pending vendor/rvc -- vocal isolation (demucs) and slicing use RVC's own
    # preprocessing scripts (infer/modules/train/preprocess.py) rather than reimplementing them.
    raise NotImplementedError("vendor RVC first: git submodule update --init vendor/rvc")
