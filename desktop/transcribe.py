"""Offline transcription. Audio travels over stdin, not via temporary files."""
import io
import json
import sys
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding="utf-8")
try:
    model = WhisperModel("small", device="cpu", compute_type="int8", cpu_threads=4, local_files_only=True)
    if "--check" in sys.argv:
        print(json.dumps({"ready": True}))
    else:
        audio = sys.stdin.buffer.read(12 * 1024 * 1024 + 1)
        if len(audio) > 12 * 1024 * 1024:
            raise ValueError("Audio too large")
        segments, _ = model.transcribe(io.BytesIO(audio), language="zh", vad_filter=True, beam_size=3, condition_on_previous_text=False)
        text = "".join(segment.text for segment in segments).strip()
        print(json.dumps({"text": text[:6000]}, ensure_ascii=False))
except Exception:
    print(json.dumps({"error": "本机语音识别未完成，请检查本地模型是否可用并重试。"}, ensure_ascii=False))
    sys.exit(1)
