import hashlib
import os
import threading
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "voice_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

_model = None
_model_lock = threading.Lock()


class VoiceEngineUnavailable(RuntimeError):
    pass


def voice_enabled() -> bool:
    return os.getenv("CHATTERBOX_ENABLED", "false").lower() == "true"


def voice_device() -> str:
    return os.getenv("CHATTERBOX_DEVICE", "cpu")


def reference_voice_path(voice_id: str) -> Optional[str]:
    env_key = f"CHATTERBOX_VOICE_{voice_id.upper()}"
    path = os.getenv(env_key)
    if path and Path(path).exists():
        return path
    return None


def get_voice_id(sexo: str) -> str:
    normalized = (sexo or "no_especificado").lower()
    if normalized.startswith("f"):
        return "femenino"
    if normalized.startswith("m"):
        return "masculino"
    return "neutral"


def _load_model():
    global _model
    if _model is not None:
        return _model
    if not voice_enabled():
        raise VoiceEngineUnavailable("Chatterbox voice is disabled. Set CHATTERBOX_ENABLED=true.")
    with _model_lock:
        if _model is not None:
            return _model
        try:
            from chatterbox.tts import ChatterboxTTS
        except Exception as exc:
            raise VoiceEngineUnavailable("chatterbox-tts is not installed.") from exc
        _model = ChatterboxTTS.from_pretrained(device=voice_device())
        return _model


def synthesize_to_cache(text: str, sexo: str, agent_id: str, language: str = "es") -> Path:
    clean_text = " ".join((text or "").split()).strip()
    if not clean_text:
        raise ValueError("Text is required")
    safe_text = clean_text[:240]
    voice_id = get_voice_id(sexo)
    fingerprint = hashlib.sha256(f"{agent_id}|{voice_id}|{language}|{safe_text}".encode("utf-8")).hexdigest()[:24]
    output_path = CACHE_DIR / f"{fingerprint}.wav"
    if output_path.exists():
        return output_path

    model = _load_model()
    audio_prompt_path = reference_voice_path(voice_id)
    kwargs = {"audio_prompt_path": audio_prompt_path} if audio_prompt_path else {}
    wav = model.generate(safe_text, **kwargs)

    try:
        import torchaudio as ta
    except Exception as exc:
        raise VoiceEngineUnavailable("torchaudio is required by Chatterbox output.") from exc

    ta.save(str(output_path), wav, model.sr)
    return output_path


def status_payload() -> dict:
    return {
        "enabled": voice_enabled(),
        "device": voice_device(),
        "available": _is_available(),
        "cache_dir": str(CACHE_DIR),
        "voices": {
            "femenino": bool(reference_voice_path("femenino")),
            "masculino": bool(reference_voice_path("masculino")),
            "neutral": bool(reference_voice_path("neutral")),
        },
    }


def _is_available() -> bool:
    try:
        import chatterbox.tts  # noqa: F401
        import torchaudio  # noqa: F401
        return True
    except Exception:
        return False
