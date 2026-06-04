from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from models import AgentUpdate, AgentCreate
from config_manager import load_agents, save_agents

router = APIRouter(prefix="/agents", tags=["agents"])

@router.get("")
def agents() -> Dict[str, Any]:
    return load_agents()

@router.put("/{agent_id}")
def update_agent(agent_id: str, payload: AgentUpdate) -> Dict[str, Any]:
    registry = load_agents()
    agents_map = registry.setdefault("agents", {})
    if agent_id not in agents_map:
        raise HTTPException(status_code=404, detail="Agent not found")
    update = payload.model_dump(exclude_none=True)
    agents_map[agent_id] = {**agents_map[agent_id], **update}
    save_agents(registry)
    return {"agent_id": agent_id, "agent": agents_map[agent_id]}

@router.post("")
def create_agent(payload: AgentCreate) -> Dict[str, Any]:
    registry = load_agents()
    agents_map = registry.setdefault("agents", {})
    agent_id = payload.agent_id.strip()
    if agent_id in agents_map:
        raise HTTPException(status_code=400, detail="Agent ID already exists")
    
    new_agent = payload.model_dump()
    del new_agent["agent_id"]
    
    agents_map[agent_id] = new_agent
    save_agents(registry)
    return {"agent_id": agent_id, "agent": agents_map[agent_id]}
