"""Text -> speech (neutral base voice), for feeding into inference.convert()."""

from pathlib import Path

import edge_tts

DEFAULT_TTS_VOICE = "en-US-GuyNeural"


async def synthesize(text: str, output_path: Path, tts_voice: str = DEFAULT_TTS_VOICE) -> Path:
    await edge_tts.Communicate(text, tts_voice).save(str(output_path))
    return output_path
