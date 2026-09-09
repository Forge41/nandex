"""Core voice conversion: convert(input_audio, voice_name) -> output_audio, via
vendor/rvc's infer/cli.py."""

import subprocess
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import RVC_ROOT, voice_model_dir

# infer/cli.py reliably finishes its real work (logs a success status and writes the
# output file) but then hangs indefinitely instead of exiting -- some non-daemon thread
# from torch/faiss never joins. Rather than patch vendored RVC internals for that, poll
# for a stable output file instead of waiting on the process to exit; kill it once done.
POLL_INTERVAL_S = 0.5
STABLE_FOR_S = 1.0
TIMEOUT_S = 180


def convert(input_path: Path, voice_name: str, pitch_shift: int = 0) -> Path:
    model_dir = voice_model_dir(voice_name)
    model_path = model_dir / "model.pth"
    index_path = model_dir / "model.index"
    if not model_path.is_file():
        raise FileNotFoundError(f"No trained model at {model_path}")

    output_path = input_path.with_name(f"{input_path.stem}.{voice_name}.wav")
    process = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "infer.cli",  # not infer/cli.py -- its absolute imports need RVC_ROOT on sys.path,
            # which only -m (adding cwd) provides; a plain script path only adds infer/ itself.
            "--model",
            str(model_path.resolve()),
            "--input",
            str(input_path.resolve()),
            "--output",
            str(output_path.resolve()),
            "--pitch",
            str(pitch_shift),
            "--index",
            str(index_path.resolve()),
            "--index-rate",
            "0.75",
            "--f0-method",
            "rmvpe",
            "--overwrite",
        ],
        cwd=RVC_ROOT,
    )

    deadline = time.monotonic() + TIMEOUT_S
    last_size, stable_since = -1, None
    try:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                if process.returncode != 0:
                    raise subprocess.CalledProcessError(process.returncode, process.args)
                break
            if output_path.is_file():
                size = output_path.stat().st_size
                if size == last_size and size > 0:
                    if stable_since is None:
                        stable_since = time.monotonic()
                    elif time.monotonic() - stable_since >= STABLE_FOR_S:
                        break
                else:
                    last_size, stable_since = size, None
            time.sleep(POLL_INTERVAL_S)
        else:
            raise TimeoutError(f"infer.cli produced no stable output within {TIMEOUT_S}s")
    finally:
        if process.poll() is None:
            process.kill()
            process.wait()

    return output_path
