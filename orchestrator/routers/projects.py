from fastapi import APIRouter, BackgroundTasks, HTTPException, WebSocket, WebSocketDisconnect
from typing import List, Dict, Any
import uuid
import psycopg
import os
import subprocess
import sys

from models import ProjectState, ProjectCreate, ApprovalRequest, ChatMessage
from project_service import (
    PROJECTS, build_initial_phases, append_log, persist_project,
    run_project, SUBSCRIBERS, publish, upsert_phase_run
)
from database import db_dsn
from config_manager import now_iso

router = APIRouter(prefix="/projects", tags=["projects"])

@router.post("", response_model=ProjectState)
async def create_project(payload: ProjectCreate, background_tasks: BackgroundTasks) -> ProjectState:
    project_id = str(uuid.uuid4())
    state = ProjectState(
        id=project_id,
        name=payload.name,
        client_goal=payload.client_goal,
        budget=payload.budget,
        phases=build_initial_phases(),
        created_at=now_iso(),
        updated_at=now_iso(),
    )
    PROJECTS[project_id] = state
    append_log(state, "founder", "intake", "Nuevo requerimiento recibido.", payload.model_dump())
    persist_project(state)
    background_tasks.add_task(run_project, project_id)
    return state

@router.get("")
def list_projects() -> List[ProjectState]:
    return list(PROJECTS.values())

@router.get("/{project_id}", response_model=ProjectState)
def get_project(project_id: str) -> ProjectState:
    state = PROJECTS.get(project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Project not found")
    return state

@router.post("/{project_id}/approve-contract", response_model=ProjectState)
async def approve_contract(project_id: str, payload: ApprovalRequest, background_tasks: BackgroundTasks) -> ProjectState:
    state = PROJECTS.get(project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Project not found")
    phase = state.phases["founder_approval"]
    if state.status != "waiting_approval" or phase["status"] != "running":
        raise HTTPException(status_code=400, detail="Project is not waiting for founder approval")
    if not payload.approved:
        state.status = "failed"
        phase["status"] = "failed"
        phase["error"] = payload.founder_note or "Rejected by founder"
        append_log(state, "founder", "founder_approval", "Contrato rechazado.", payload.model_dump())
        upsert_phase_run(state, "founder_approval", "failed", error=phase["error"])
        await publish(project_id)
        return state
    phase["status"] = "completed"
    phase["completed_at"] = now_iso()
    append_log(state, "founder", "founder_approval", "Contrato aprobado. Continuando con arquitectura.", payload.model_dump())
    state.status = "running"
    upsert_phase_run(state, "founder_approval", "completed")
    persist_project(state)
    await publish(project_id)
    background_tasks.add_task(run_project, project_id)
    return state

@router.delete("/{project_id}")
def delete_project(project_id: str) -> Dict[str, str]:
    if project_id in PROJECTS:
        # Retrieve project name before deletion to delete workspace
        project_name = PROJECTS[project_id].name
        workspace_dir = os.path.join(os.getcwd(), "..", "mcp_servers", "workspace_tools", "workspace", project_name)
        
        del PROJECTS[project_id]
        try:
            with psycopg.connect(db_dsn(), autocommit=True) as conn:
                conn.execute("DELETE FROM projects WHERE id = %s", (project_id,))
        except Exception:
            pass
            
        # Delete workspace directory
        if os.path.exists(workspace_dir):
            import shutil
            try:
                shutil.rmtree(workspace_dir)
            except Exception:
                pass
                
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Project not found")

@router.post("/{project_id}/open-workspace")
def open_workspace(project_id: str) -> Dict[str, str]:
    state = PROJECTS.get(project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Project not found")
    
    project_name = state.name
    workspace_dir = os.path.join(os.getcwd(), "..", "mcp_servers", "workspace_tools", "workspace", project_name)
    workspace_dir = os.path.abspath(workspace_dir)
    
    if not os.path.exists(workspace_dir):
        os.makedirs(workspace_dir, exist_ok=True)
        
    try:
        if os.name == 'nt':
            os.startfile(workspace_dir)
        elif sys.platform == 'darwin':
            subprocess.Popen(['open', workspace_dir])
        else:
            subprocess.Popen(['xdg-open', workspace_dir])
        return {"status": "opened"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to open workspace: {str(e)}")

@router.post("/{project_id}/stop", response_model=ProjectState)
async def stop_project(project_id: str) -> ProjectState:
    state = PROJECTS.get(project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Project not found")
    if state.status == "running":
        state.status = "failed"
        for phase in state.phases.values():
            if phase.get("status") == "running":
                phase["status"] = "failed"
                phase["error"] = "Proceso detenido por el usuario."
        append_log(state, "system", "control", "Proceso detenido por el usuario.")
        persist_project(state)
        await publish(project_id)
    return state

@router.post("/{project_id}/retry", response_model=ProjectState)
async def retry_project(project_id: str, background_tasks: BackgroundTasks) -> ProjectState:
    state = PROJECTS.get(project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Project not found")
    
    failed_any = False
    for phase_id, phase in state.phases.items():
        if phase.get("status") == "failed":
            phase["status"] = "pending"
            phase["error"] = None
            failed_any = True
            append_log(state, "system", phase_id, f"Fase {phase_id} reiniciada para reintento.")
            
    state.status = "running"
    append_log(state, "founder", "control", "Intervención del fundador completada. Reanudando ejecución.")
    persist_project(state)
    await publish(project_id)
    background_tasks.add_task(run_project, project_id)
    return state

@router.post("/{project_id}/rollback/{phase_id}", response_model=ProjectState)
async def rollback_phase(project_id: str, phase_id: str, background_tasks: BackgroundTasks) -> ProjectState:
    state = PROJECTS.get(project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Project not found")
        
    if phase_id not in state.phases:
        raise HTTPException(status_code=404, detail="Phase not found")
        
    def reset_phase_and_dependents(pid: str):
        if pid in state.phases:
            state.phases[pid]["status"] = "pending"
            state.phases[pid]["error"] = None
            state.phases[pid]["started_at"] = None
            state.phases[pid]["completed_at"] = None
            
        for child_id, child_phase in state.phases.items():
            if pid in child_phase.get("depends_on", []):
                reset_phase_and_dependents(child_id)
                
    reset_phase_and_dependents(phase_id)
    
    # Clean up artifacts generated during this phase
    state.artifacts = [a for a in state.artifacts if a.get("type") != phase_id]
    
    state.status = "running"
    state.current_phase = phase_id
    append_log(state, "founder", "control", f"Fase {phase_id} revertida. Reanudando ejecución.")
    persist_project(state)
    await publish(project_id)
    background_tasks.add_task(run_project, project_id)
    return state

@router.post("/{project_id}/chat", response_model=ProjectState)
async def chat_iteration(project_id: str, payload: ChatMessage, background_tasks: BackgroundTasks) -> ProjectState:
    state = PROJECTS.get(project_id)
    if not state:
        raise HTTPException(status_code=404, detail="Project not found")
        
    iteration_id = f"iteration_{uuid.uuid4().hex[:8]}"
    
    # Añadir nueva fase dinámica dependiente de nada para forzar ejecución
    state.phases[iteration_id] = {
        "id": iteration_id,
        "agent": "coder", # Podríamos hacer que sea dinámico, pero 'coder' es ideal para cambios.
        "depends_on": [],
        "status": "pending",
        "goal_override": f"Continuity Iteration Request:\n{payload.message}\nReview the existing code in the workspace and apply the requested changes."
    }
    
    state.status = "running"
    append_log(state, "founder", "chat", f"Nueva iteración solicitada: {payload.message}")
    persist_project(state)
    await publish(project_id)
    background_tasks.add_task(run_project, project_id)
    return state
