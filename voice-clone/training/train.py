"""Train an RVC model on extracted features, writing models/<voice_name>/model.{pth,index}."""

from pathlib import Path


def train(voice_name: str, processed_dir: Path, models_dir: Path, epochs: int = 200) -> None:
    # Pending vendor/rvc -- wraps RVC's train_nsf_sim_cache_sid_load_pretrain.py.
    raise NotImplementedError("vendor RVC first: git submodule update --init vendor/rvc")
