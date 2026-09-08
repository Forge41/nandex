"""Minimal text -> speech -> voice-conversion app: POST /speak synthesizes text with a
neutral TTS voice, then converts it through a trained RVC model."""

import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.tts import synthesize
from inference.convert import convert
from paths import MODELS_DIR

app = FastAPI(title="voice-clone")
app.mount("/static", StaticFiles(directory=Path(__file__).parent / "static"), name="static")


class SpeakRequest(BaseModel):
    text: str
    voice_name: str
    pitch_shift: int = 0


@app.get("/")
async def index() -> FileResponse:
    return FileResponse(Path(__file__).parent / "static" / "index.html")


@app.get("/voices")
async def voices() -> list[str]:
    if not MODELS_DIR.is_dir():
        return []
    return sorted(d.name for d in MODELS_DIR.iterdir() if (d / "model.pth").is_file())


@app.post("/speak")
async def speak(req: SpeakRequest) -> FileResponse:
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    if not (MODELS_DIR / req.voice_name / "model.pth").is_file():
        raise HTTPException(
            status_code=404, detail=f"No trained model for voice '{req.voice_name}'"
        )

    with tempfile.TemporaryDirectory() as tmp:
        tts_path = Path(tmp) / "tts.wav"
        await synthesize(req.text, tts_path)
        output_path = convert(tts_path, req.voice_name, pitch_shift=req.pitch_shift)
        # convert() writes next to its input, inside this tempdir -- copy out before it's cleaned up.
        persisted = Path(tempfile.mkstemp(suffix=".wav")[1])
        persisted.write_bytes(output_path.read_bytes())

    return FileResponse(persisted, media_type="audio/wav", filename="speech.wav")
