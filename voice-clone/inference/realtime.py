"""Low-latency streaming inference. RVC exposes this only as realtime_gui.py, a
Tkinter + sounddevice desktop app -- there's no headless real-time API to wrap, so
this launches that GUI directly rather than faking a programmatic interface."""

import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from paths import RVC_ROOT


def run_realtime() -> None:
    subprocess.run([sys.executable, "realtime_gui.py"], cwd=RVC_ROOT, check=True)
