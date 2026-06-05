from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from models import VoiceSynthesisRequest
from voice_engine import VoiceEngineUnavailable, status_payload, synthesize_to_cache

router = APIRouter(prefix="/voice", tags=["voice"])


@router.get("/status")
def get_voice_status() -> dict:
    return status_payload()


@router.post("/synthesize")
def synthesize_voice(payload: VoiceSynthesisRequest) -> FileResponse:
    try:
        path = synthesize_to_cache(
            text=payload.text,
            sexo=payload.sexo,
            agent_id=payload.agent_id,
            language=payload.language,
        )
    except VoiceEngineUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return FileResponse(path, media_type="audio/wav", filename=path.name)
