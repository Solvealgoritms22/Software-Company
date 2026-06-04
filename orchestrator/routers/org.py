from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from models import (
    SkillCreate, SkillUpdate, DeliverableCreate, DeliverableUpdate,
    DepartmentCreate, DepartmentUpdate
)
from config_manager import load_agents, save_agents, load_departments, save_departments

router = APIRouter(tags=["org"])

@router.get("/skills")
def list_skills() -> List[Dict[str, Any]]:
    registry = load_agents()
    skills = registry.get("skills")
    if skills is None:
        unique_skills = set()
        agents_dict = registry.get("agents", {})
        for agent in agents_dict.values():
            for s in agent.get("skills", []):
                unique_skills.add(s)
        skills = [{"name": s, "description": "Habilidad importada automáticamente."} for s in sorted(unique_skills)]
        registry["skills"] = skills
        save_agents(registry)
    return skills

@router.post("/skills")
def create_skill(payload: SkillCreate) -> List[Dict[str, Any]]:
    registry = load_agents()
    skills = registry.setdefault("skills", [])
    name_clean = payload.name.strip()
    for skill in skills:
        if skill["name"].lower() == name_clean.lower():
            raise HTTPException(status_code=400, detail="Skill already exists")
    
    skills.append({"name": name_clean, "description": payload.description})
    save_agents(registry)
    return skills

@router.put("/skills")
def update_skill_endpoint(payload: SkillUpdate) -> List[Dict[str, Any]]:
    registry = load_agents()
    skills = registry.setdefault("skills", [])
    
    found_skill = None
    for skill in skills:
        if skill["name"].lower() == payload.old_name.strip().lower():
            found_skill = skill
            break
            
    if not found_skill:
        raise HTTPException(status_code=404, detail="Skill not found")
        
    old_name_clean = found_skill["name"]
    new_name_clean = payload.name.strip()
    found_skill["name"] = new_name_clean
    found_skill["description"] = payload.description
    
    if old_name_clean != new_name_clean:
        agents_map = registry.get("agents", {})
        for agent in agents_map.values():
            agent_skills = agent.get("skills", [])
            for idx, s in enumerate(agent_skills):
                if s == old_name_clean:
                    agent_skills[idx] = new_name_clean
                    
    save_agents(registry)
    return skills

@router.delete("/skills/{skill_name}")
def delete_skill(skill_name: str) -> List[Dict[str, Any]]:
    registry = load_agents()
    skills = registry.setdefault("skills", [])
    
    registry["skills"] = [s for s in skills if s["name"].lower() != skill_name.lower()]
    
    agents_map = registry.get("agents", {})
    for agent in agents_map.values():
        agent_skills = agent.get("skills", [])
        agent["skills"] = [s for s in agent_skills if s.lower() != skill_name.lower()]
        
    save_agents(registry)
    return registry["skills"]

@router.get("/deliverables")
def list_deliverables() -> List[Dict[str, Any]]:
    registry = load_agents()
    deliverables = registry.get("deliverables")
    if not deliverables:
        deliverables = []
        seen = set()
        for agent in registry.get("agents", {}).values():
            for d in agent.get("deliverables", []):
                if d not in seen:
                    seen.add(d)
                    deliverables.append({
                        "code": d,
                        "name": d.replace("_", " ").title(),
                        "description": "Auto-generated deliverable from agent registry."
                    })
        registry["deliverables"] = deliverables
        save_agents(registry)
    return deliverables

@router.post("/deliverables")
def create_deliverable(payload: DeliverableCreate) -> List[Dict[str, Any]]:
    registry = load_agents()
    deliverables = registry.setdefault("deliverables", [])
    code_clean = payload.code.strip()
    for item in deliverables:
        if item["code"].lower() == code_clean.lower():
            raise HTTPException(status_code=400, detail="Deliverable code already exists")
    
    deliverables.append({"name": payload.name.strip(), "description": payload.description, "code": code_clean})
    save_agents(registry)
    return deliverables

@router.put("/deliverables")
def update_deliverable_endpoint(payload: DeliverableUpdate) -> List[Dict[str, Any]]:
    registry = load_agents()
    deliverables = registry.setdefault("deliverables", [])
    
    found_item = None
    for item in deliverables:
        if item["code"].lower() == payload.old_code.strip().lower():
            found_item = item
            break
            
    if not found_item:
        raise HTTPException(status_code=404, detail="Deliverable not found")
        
    old_code_clean = found_item["code"]
    new_code_clean = payload.code.strip()
    found_item["name"] = payload.name.strip()
    found_item["description"] = payload.description
    found_item["code"] = new_code_clean
    
    if old_code_clean != new_code_clean:
        agents_map = registry.get("agents", {})
        for agent in agents_map.values():
            agent_deliverables = agent.get("deliverables", [])
            for idx, s in enumerate(agent_deliverables):
                if s.lower() == old_code_clean.lower():
                    agent_deliverables[idx] = new_code_clean
            agent["deliverables"] = agent_deliverables
            
    save_agents(registry)
    return deliverables

@router.delete("/deliverables/{deliverable_code}")
def delete_deliverable(deliverable_code: str) -> List[Dict[str, Any]]:
    registry = load_agents()
    deliverables = registry.setdefault("deliverables", [])
    
    registry["deliverables"] = [s for s in deliverables if s["code"].lower() != deliverable_code.lower()]
    
    agents_map = registry.get("agents", {})
    for agent in agents_map.values():
        agent_deliverables = agent.get("deliverables", [])
        agent["deliverables"] = [s for s in agent_deliverables if s.lower() != deliverable_code.lower()]
        
    save_agents(registry)
    return registry["deliverables"]

@router.get("/departments")
def list_departments() -> Dict[str, Any]:
    return load_departments()

@router.post("/departments")
def create_department(payload: DepartmentCreate) -> Dict[str, Any]:
    data = load_departments()
    deps = data.setdefault("departments", {})
    dep_id = payload.id.strip()
    if dep_id in deps:
        raise HTTPException(status_code=400, detail="Department ID already exists")
    deps[dep_id] = payload.model_dump()
    save_departments(data)
    return {"department": deps[dep_id]}

@router.put("/departments/{dep_id}")
def update_department(dep_id: str, payload: DepartmentUpdate) -> Dict[str, Any]:
    data = load_departments()
    deps = data.setdefault("departments", {})
    if dep_id not in deps:
        raise HTTPException(status_code=404, detail="Department not found")
    update = payload.model_dump(exclude_none=True)
    deps[dep_id] = {**deps[dep_id], **update}
    save_departments(data)
    return {"department": deps[dep_id]}

@router.delete("/departments/{dep_id}")
def delete_department(dep_id: str) -> Dict[str, Any]:
    data = load_departments()
    deps = data.setdefault("departments", {})
    if dep_id not in deps:
        raise HTTPException(status_code=404, detail="Department not found")
    
    registry = load_agents()
    agents_map = registry.get("agents", {})
    updated = False
    for agent in agents_map.values():
        if agent.get("department_id") == dep_id:
            agent["department_id"] = None
            updated = True
    if updated:
        save_agents(registry)
        
    del deps[dep_id]
    save_departments(data)
    return {"status": "ok"}
