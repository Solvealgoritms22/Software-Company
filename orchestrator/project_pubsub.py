import asyncio
import json
from contextlib import suppress
from typing import Dict, List, Optional

from fastapi import WebSocket

from models import ProjectState


async def send_project_state(
    project_id: str,
    state: ProjectState,
    subscribers_by_project: Dict[str, List[WebSocket]],
) -> None:
    await _send_payload(project_id, state.model_dump_json(), subscribers_by_project)


async def send_project_token(
    project_id: str,
    phase_id: str,
    token: str,
    subscribers_by_project: Dict[str, List[WebSocket]],
) -> None:
    payload = json.dumps({"type": "token", "phase": phase_id, "token": token})
    await _send_payload(project_id, payload, subscribers_by_project)


async def _send_payload(
    project_id: str,
    payload: str,
    subscribers_by_project: Dict[str, List[WebSocket]],
) -> None:
    subscribers = list(subscribers_by_project.get(project_id, []))

    async def send(ws: WebSocket) -> Optional[WebSocket]:
        try:
            await asyncio.wait_for(ws.send_text(payload), timeout=5)
            return None
        except Exception:
            return ws

    dead = [ws for ws in await asyncio.gather(*(send(ws) for ws in subscribers)) if ws]
    for ws in dead:
        with suppress(ValueError):
            subscribers_by_project.get(project_id, []).remove(ws)
    if not subscribers_by_project.get(project_id):
        subscribers_by_project.pop(project_id, None)
