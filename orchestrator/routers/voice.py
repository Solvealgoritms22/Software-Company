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


@router.get("/stream")
def stream_voice(
    text: str,
    sexo: str = "neutral",
    language: str = "es",
    agent_id: str = "agent"
):
    import os
    remote_url = os.getenv("CHATTERBOX_REMOTE_URL")
    if remote_url:
        import httpx
        from fastapi.responses import StreamingResponse
        
        def stream_from_colab():
            with httpx.stream("POST", f"{remote_url}/synthesize", json={
                "text": text,
                "sexo": sexo,
                "language": language
            }, timeout=60.0) as r:
                r.raise_for_status()
                for chunk in r.iter_bytes():
                    yield chunk
                    
        return StreamingResponse(stream_from_colab(), media_type="audio/wav")
    else:
        try:
            path = synthesize_to_cache(
                text=text,
                sexo=sexo,
                agent_id=agent_id,
                language=language,
            )
            return FileResponse(path, media_type="audio/wav", filename=path.name)
        except VoiceEngineUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

