"""Content (HuBERT/ContentVec) and pitch feature extraction for a processed voice dataset."""

from pathlib import Path


def extract_features(voice_name: str, processed_dir: Path, pretrained_dir: Path) -> None:
    # Pending vendor/rvc -- wraps RVC's extract_feature_print.py + extract_f0_*.py.
    raise NotImplementedError("vendor RVC first: git submodule update --init vendor/rvc")
