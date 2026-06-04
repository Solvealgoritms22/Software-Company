from fastapi import APIRouter
from typing import Dict, Any

from models import CompanySettings
from config_manager import load_settings, save_settings

router = APIRouter(prefix="/settings", tags=["settings"])

@router.get("")
def get_settings() -> Dict[str, Any]:
    return load_settings()

@router.put("")
def update_settings(payload: CompanySettings) -> Dict[str, Any]:
    data = payload.model_dump()
    save_settings(data)
    return data
