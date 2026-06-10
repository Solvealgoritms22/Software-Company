import os
from contextlib import asynccontextmanager, suppress
from typing import Dict

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware

from config_manager import load_secret_store
from database import ensure_schema
from mcp_pool import close_mcp_pool
from routers import settings, workspace, mcp, agents, org, projects, voice, updates
from project_service import SUBSCRIBERS, PROJECTS, load_projects


def cors_origins() -> list[str]:
    raw = os.getenv("ORCHESTRATOR_CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000,http://localhost:3005,http://127.0.0.1:3005,tauri://localhost")
    return [origin.strip() for origin in raw.split(",") if origin.strip()]

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        store = load_secret_store()
        for key, val in store.items():
            if val:
                os.environ[key] = val
    except Exception as exc:
        print(f"Error loading secrets into environment: {exc}")
    
    try:
        await ensure_schema()
        load_projects()
    except Exception as exc:
        print(f"Error initializing DB schema: {exc}")
    yield
    try:
        await close_mcp_pool()
    except Exception as exc:
        print(f"Error closing MCP session pool: {exc}")

app = FastAPI(title="Software Company Orchestrator", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from auth import verify_api_key

app.include_router(settings.router, dependencies=[Depends(verify_api_key)])
app.include_router(workspace.router, dependencies=[Depends(verify_api_key)])
app.include_router(mcp.router, dependencies=[Depends(verify_api_key)])
app.include_router(agents.router, dependencies=[Depends(verify_api_key)])
app.include_router(org.router, dependencies=[Depends(verify_api_key)])
app.include_router(projects.router, dependencies=[Depends(verify_api_key)])
app.include_router(voice.router, dependencies=[Depends(verify_api_key)])
app.include_router(updates.router, dependencies=[Depends(verify_api_key)])

@app.websocket("/ws/projects/{project_id}")
async def project_ws(websocket: WebSocket, project_id: str, auth: bool = Depends(verify_api_key)) -> None:
    await websocket.accept()
    subscribers = SUBSCRIBERS.setdefault(project_id, [])
    subscribers.append(websocket)
    try:
        if project_id in PROJECTS:
            await websocket.send_text(PROJECTS[project_id].model_dump_json())
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        with suppress(ValueError):
            subscribers.remove(websocket)
        if not subscribers:
            SUBSCRIBERS.pop(project_id, None)

@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
