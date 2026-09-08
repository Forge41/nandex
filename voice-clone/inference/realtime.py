"""Low-latency streaming inference -- sliding-window conversion for live audio input."""


def run_realtime(voice_name: str, models_dir: str, block_size_ms: int = 200) -> None:
    # Pending vendor/rvc -- wraps RVC's gui_v1.py real-time inference path.
    raise NotImplementedError("vendor RVC first: git submodule update --init vendor/rvc")
