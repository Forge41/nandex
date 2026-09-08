"""Generate config.json + filelist.txt, train, then build the retrieval index --
mirrors vendor/rvc/webui.py's click_train, single-speaker path only (speaker_id 0).

Writes vendor/rvc/assets/weights/<voice_name>.pth and an added_*.index under
vendor/rvc/assets/indices/, then copies both into models/<voice_name>/.
"""

import copy
import json
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import RVC_ROOT, voice_model_dir

VERSION = "v2"
SAMPLE_RATE = "40k"
SPEAKER_ID = 0

# webui.py: "if version19 == 'v1' or sr2 == '40k': config_path = 'v1/%s.json' % sr2" --
# v2 has no distinct 40k config, only 32k/48k do; 40k always reuses the v1 architecture.
CONFIG_TEMPLATE = RVC_ROOT / "configs" / "v1" / f"{SAMPLE_RATE}.json"


def _write_config(exp_dir: Path) -> None:
    config_data = json.loads(CONFIG_TEMPLATE.read_text(encoding="utf8"))
    (exp_dir / "config.json").write_text(
        json.dumps(config_data, ensure_ascii=False, indent=4, sort_keys=True) + "\n", encoding="utf8"
    )


def _write_filelist(exp_dir: Path) -> None:
    gt_wavs_dir = exp_dir / "0_gt_wavs"
    feature_dir = exp_dir / "3_feature768"  # v2; v1 would be 3_feature256
    f0_dir = exp_dir / "2a_f0"
    f0nsf_dir = exp_dir / "2b-f0nsf"

    names = (
        {p.stem for p in gt_wavs_dir.iterdir()}
        & {p.stem for p in feature_dir.iterdir()}
        & {p.stem for p in f0_dir.iterdir()}
        & {p.stem for p in f0nsf_dir.iterdir()}
    )
    if not names:
        raise RuntimeError("No audio survived preprocessing + feature extraction -- nothing to train on")

    lines = [
        f"{gt_wavs_dir}/{name}.wav|{feature_dir}/{name}.npy|{f0_dir}/{name}.wav.npy|{f0nsf_dir}/{name}.wav.npy|{SPEAKER_ID}"
        for name in sorted(names)
    ]
    # Mute rows: f0-enabled training requires at least one silent reference row per
    # speaker, sourced from RVC's own vendored mute assets (see download_pretrained.sh).
    mute_dir = RVC_ROOT / "logs" / "mute"
    for _ in range(2):
        lines.append(
            f"{mute_dir}/0_gt_wavs/mute{SAMPLE_RATE}.wav|{mute_dir}/3_feature768/mute.npy|"
            f"{mute_dir}/2a_f0/mute.wav.npy|{mute_dir}/2b-f0nsf/mute.wav.npy|{SPEAKER_ID}"
        )

    (exp_dir / "filelist.txt").write_text("\n".join(lines), encoding="utf8")


def train(voice_name: str, total_epoch: int = 200, save_every_epoch: int = 50, batch_size: int = 4) -> None:
    exp_dir = RVC_ROOT / "logs" / voice_name
    _write_config(exp_dir)
    _write_filelist(exp_dir)

    subprocess.run(
        [
            sys.executable,
            "train/train.py",
            "-e", voice_name,
            "-sr", SAMPLE_RATE,
            "-f0", "1",
            "-bs", str(batch_size),
            "-te", str(total_epoch),
            "-se", str(save_every_epoch),
            "-pg", f"assets/pretrained_{VERSION}/f0G{SAMPLE_RATE}.pth",
            "-pd", f"assets/pretrained_{VERSION}/f0D{SAMPLE_RATE}.pth",
            "-l", "1",   # if_latest: keep only the newest checkpoint
            "-c", "0",   # if_cache_data_in_gpu: no GPU assumed by default
            "-sw", "0",  # save_every_weights: extract a model.pth at every save, not just at the end
            "-v", VERSION,
        ],
        cwd=RVC_ROOT,
        check=True,
    )

    subprocess.run(
        [sys.executable, "train/train_index.py", voice_name, VERSION, "assets/indices", "1"],
        cwd=RVC_ROOT,
        check=True,
    )

    _collect_outputs(voice_name)


def _collect_outputs(voice_name: str) -> None:
    out_dir = voice_model_dir(voice_name)
    out_dir.mkdir(parents=True, exist_ok=True)

    weight_path = RVC_ROOT / "assets" / "weights" / f"{voice_name}.pth"
    shutil.copy(weight_path, out_dir / "model.pth")

    index_matches = sorted((RVC_ROOT / "assets" / "indices").glob(f"{voice_name}_*added*.index"))
    if not index_matches:
        raise FileNotFoundError(f"train_index.py produced no index for '{voice_name}'")
    shutil.copy(index_matches[-1], out_dir / "model.index")
