"""Pitch (f0) and content (HuBERT) feature extraction over an already-preprocessed
experiment dir (vendor/rvc/logs/<voice_name>/, from training/preprocess.py)."""

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import RVC_ROOT

VERSION = (
    "v2"  # fea_dim 768; matches the pretrained_v2/f0*40k.pth checkpoints train.py warm-starts from
)


def extract_features(voice_name: str) -> None:
    exp_dir = RVC_ROOT / "logs" / voice_name

    subprocess.run(
        [sys.executable, "train/dataset/extract_f0.py", "cpu", str(exp_dir), "1", "rmvpe"],
        cwd=RVC_ROOT,
        check=True,
    )
    # len(sys.argv) == 7 selects extract_hubert_feature.py's no-GPU-index arg path:
    # device, n_part, i_part, exp_dir, version, is_half (6 params + script name).
    subprocess.run(
        [
            sys.executable,
            "train/dataset/extract_hubert_feature.py",
            "cpu",
            "1",  # n_part: worker count
            "0",  # i_part: this worker's index
            str(exp_dir),
            VERSION,
            "False",  # is_half
        ],
        cwd=RVC_ROOT,
        check=True,
    )
