"""Core voice conversion: convert(input_audio, voice_name) -> output_audio, via
vendor/rvc's infer/cli.py."""

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import RVC_ROOT, voice_model_dir


def convert(input_path: Path, voice_name: str, pitch_shift: int = 0) -> Path:
    model_dir = voice_model_dir(voice_name)
    model_path = model_dir / "model.pth"
    index_path = model_dir / "model.index"
    if not model_path.is_file():
        raise FileNotFoundError(f"No trained model at {model_path}")

    output_path = input_path.with_name(f"{input_path.stem}.{voice_name}.wav")
    subprocess.run(
        [
            sys.executable,
            "infer/cli.py",
            "--model", str(model_path.resolve()),
            "--input", str(input_path.resolve()),
            "--output", str(output_path.resolve()),
            "--pitch", str(pitch_shift),
            "--index", str(index_path.resolve()),
            "--index-rate", "0.75",
            "--f0-method", "rmvpe",
            "--overwrite",
        ],
        cwd=RVC_ROOT,
        check=True,
    )
    return output_path
