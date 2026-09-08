from pathlib import Path

ROOT = Path(__file__).resolve().parent
RVC_ROOT = ROOT / "vendor" / "rvc"
MODELS_DIR = ROOT / "models"
DATA_DIR = ROOT / "data"


def voice_model_dir(voice_name: str) -> Path:
    return MODELS_DIR / voice_name
