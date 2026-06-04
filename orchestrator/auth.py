import os
import secrets
from fastapi import HTTPException, status, Query, Header
from typing import Optional

def verify_api_key(
    x_api_key: Optional[str] = Header(None, alias="X-API-Key"),
    api_key: Optional[str] = Query(None, alias="api_key")
):
    expected_key = os.getenv("ORCHESTRATOR_API_KEY")
    require_key = os.getenv("ORCHESTRATOR_REQUIRE_API_KEY", "false").lower() == "true"
    if not expected_key:
        if require_key:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="ORCHESTRATOR_REQUIRE_API_KEY=true but ORCHESTRATOR_API_KEY is not configured",
            )
        return True
    
    key = x_api_key or api_key
    if not key or not secrets.compare_digest(key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid API Key"
        )
    return True
