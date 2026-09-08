"""Core voice conversion: convert(input_audio, voice_name) -> output_audio."""

from pathlib import Path


def convert(input_path: Path, voice_name: str, models_dir: Path, pitch_shift: int = 0) -> Path:
    # Pending vendor/rvc -- wraps RVC's VC.vc_single inference call.
    raise NotImplementedError("vendor RVC first: git submodule update --init vendor/rvc")
