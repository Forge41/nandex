"""Thin HTTP wrapper around convert() for application integration."""

import shutil
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse

from inference.convert import convert

MODELS_DIR = Path(__file__).resolve().parent.parent / "models"

app = FastAPI(title="voice-clone")


@app.post("/convert/{voice_name}")
async def convert_endpoint(voice_name: str, file: UploadFile, pitch_shift: int = 0) -> FileResponse:
    if not (MODELS_DIR / voice_name).exists():
        raise HTTPException(status_code=404, detail=f"No trained model for voice '{voice_name}'")

    with tempfile.NamedTemporaryFile(suffix=Path(file.filename or "input.wav").suffix, delete=False) as tmp:
        shutil.copyfileobj(file.file, tmp)
        input_path = Path(tmp.name)

    output_path = convert(input_path, voice_name, MODELS_DIR, pitch_shift=pitch_shift)
    return FileResponse(output_path, media_type="audio/wav")
