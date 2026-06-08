from fastapi import APIRouter, HTTPException
from typing import Dict, Any

from models import AgentUpdate, AgentCreate
from config_manager import load_agents, save_agents, load_departments, load_mcp_catalog
from registry_validation import (
    clean_identifier,
    unique_clean_strings,
    validate_agent_registry,
)

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
    for list_key in ("responsibilities", "skills", "tools", "deliverables"):
        if list_key in update:
            update[list_key] = unique_clean_strings(update.get(list_key))
    if "department_id" in update and not update["department_id"]:
        update["department_id"] = None
    if "reports_to" in update and not update["reports_to"]:
        update["reports_to"] = None
    agents_map[agent_id] = {**agents_map[agent_id], **update}
    report = validate_agent_registry(registry, load_departments(), load_mcp_catalog())
    if not report.valid:
        raise HTTPException(status_code=400, detail=report.as_dict())
    save_agents(registry)
    return {"agent_id": agent_id, "agent": agents_map[agent_id]}

@router.post("")
def create_agent(payload: AgentCreate) -> Dict[str, Any]:
    registry = load_agents()
    agents_map = registry.setdefault("agents", {})
    try:
        agent_id = clean_identifier(payload.agent_id.strip().lower(), "agent_id")
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if agent_id in agents_map:
        raise HTTPException(status_code=400, detail="Agent ID already exists")
    
    new_agent = payload.model_dump()
    del new_agent["agent_id"]
    for list_key in ("responsibilities", "skills", "tools", "deliverables"):
        new_agent[list_key] = unique_clean_strings(new_agent.get(list_key))
    
    agents_map[agent_id] = new_agent
    report = validate_agent_registry(registry, load_departments(), load_mcp_catalog())
    if not report.valid:
        raise HTTPException(status_code=400, detail=report.as_dict())
    save_agents(registry)
    return {"agent_id": agent_id, "agent": agents_map[agent_id]}
