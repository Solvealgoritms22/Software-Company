import asyncio
import uuid
import json
import psycopg
from psycopg.types.json import Jsonb
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import WebSocket

from models import ProjectState
from database import db_dsn
from artifact_memory import index_artifact, reindex_project_memory, retrieve_project_memory
from llm_client import generate_phase_artifact
from config_manager import load_agents, load_mcp_catalog
from token_budget import project_cost_limit, redact_secrets

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

PROJECTS: Dict[str, ProjectState] = {}
SUBSCRIBERS: Dict[str, List[WebSocket]] = {}
RUN_LOCKS: Dict[str, asyncio.Lock] = {}

PHASES = [
    {"id": "ceo", "agent": "ceo", "depends_on": []},
    {"id": "analysis", "agent": "business_analyst", "depends_on": ["ceo"]},
    {"id": "legal_contract", "agent": "legal", "depends_on": ["analysis"]},
    {"id": "founder_approval", "agent": "ceo", "depends_on": ["legal_contract"]},
    {"id": "architecture", "agent": "software_architect", "depends_on": ["founder_approval"]},
    {"id": "senior_backend", "agent": "senior_backend", "depends_on": ["architecture"]},
    {"id": "backend_development", "agent": "backend_developer", "depends_on": ["senior_backend"]},
    {"id": "frontend_architecture", "agent": "frontend_architect", "depends_on": ["architecture"]},
    {"id": "frontend_development", "agent": "frontend_developer", "depends_on": ["frontend_architecture"]},
    {"id": "database", "agent": "dba", "depends_on": ["architecture"]},
    {"id": "qa", "agent": "qa", "depends_on": ["backend_development", "frontend_development", "database"]},
    {"id": "security", "agent": "security", "depends_on": ["qa"]},
    {"id": "devops", "agent": "devops", "depends_on": ["security"]},
    {"id": "documentation", "agent": "technical_writer", "depends_on": ["devops"]},
    {"id": "done", "agent": "ceo", "depends_on": ["documentation"]},
]

def build_initial_phases() -> Dict[str, Dict[str, Any]]:
    return {
        phase["id"]: {
            "id": phase["id"],
            "agent": phase["agent"],
            "depends_on": phase["depends_on"],
            "status": "pending",
            "started_at": None,
            "completed_at": None,
            "error": None,
        }
        for phase in PHASES
    }


def _db_execute(query: str, params: tuple[Any, ...]) -> None:
    try:
        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            conn.execute(query, params)
    except Exception:
        pass


def persist_activity_log(project: ProjectState, log: Dict[str, Any]) -> None:
    _db_execute(
        """
        INSERT INTO activity_logs (id, project_id, agent, phase, message, metadata, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (
            log["id"],
            project.id,
            log["agent"],
            log["phase"],
            log["message"],
            Jsonb(log.get("metadata", {})),
            log["created_at"],
        ),
    )


def persist_artifact_record(project: ProjectState, artifact: Dict[str, Any]) -> None:
    _db_execute(
        """
        INSERT INTO artifacts (id, project_id, type, agent, title, content, uri, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (
            artifact["id"],
            project.id,
            artifact["type"],
            artifact["agent"],
            artifact["title"],
            Jsonb(artifact.get("content", {})),
            artifact.get("uri"),
            artifact["created_at"],
        ),
    )


def upsert_phase_run(
    project: ProjectState,
    phase_id: str,
    status: str,
    error: Optional[str] = None,
    output: Optional[Dict[str, Any]] = None,
) -> None:
    phase = project.phases.get(phase_id, {})
    content = output or {}
    usage = content.get("usage") or {}
    cost = float(content.get("estimated_cost_usd") or 0)
    _db_execute(
        """
        INSERT INTO phase_runs (project_id, phase, agent, status, started_at, completed_at, error, output, usage, cost_usd)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (project_id, phase) DO UPDATE SET
            agent = EXCLUDED.agent,
            status = EXCLUDED.status,
            started_at = COALESCE(EXCLUDED.started_at, phase_runs.started_at),
            completed_at = EXCLUDED.completed_at,
            error = EXCLUDED.error,
            output = EXCLUDED.output,
            usage = EXCLUDED.usage,
            cost_usd = EXCLUDED.cost_usd
        """,
        (
            project.id,
            phase_id,
            phase.get("agent", "system"),
            status,
            phase.get("started_at"),
            phase.get("completed_at"),
            error,
            Jsonb(content),
            Jsonb(usage),
            cost,
        ),
    )


def persist_trace(project: ProjectState, phase_id: str, agent_id: str, event_type: str, content: Dict[str, Any]) -> None:
    usage = content.get("usage") or {}
    _db_execute(
        """
        INSERT INTO agent_traces (
            project_id, phase, agent, event_type, model, provider,
            prompt_tokens, completion_tokens, cached_tokens, estimated_cost_usd, metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            project.id,
            phase_id,
            agent_id,
            event_type,
            content.get("model"),
            content.get("provider"),
            int(usage.get("prompt_tokens") or 0),
            int(usage.get("completion_tokens") or 0),
            int(usage.get("cached_tokens") or 0),
            float(content.get("estimated_cost_usd") or 0),
            Jsonb({
                "summary": content.get("summary"),
                "risks": content.get("risks", []),
                "prompt_budget": content.get("prompt_budget", {}),
            }),
        ),
    )


def project_estimated_cost(project: ProjectState) -> float:
    total = 0.0
    for artifact in project.artifacts:
        content = artifact.get("content") or {}
        try:
            total += float(content.get("estimated_cost_usd") or 0)
        except Exception:
            pass
    return round(total, 6)

async def publish(project_id: str) -> None:
    state = PROJECTS.get(project_id)
    if not state:
        return
    dead: List[WebSocket] = []
    for ws in SUBSCRIBERS.get(project_id, []):
        try:
            await ws.send_text(state.model_dump_json())
        except Exception:
            dead.append(ws)
    for ws in dead:
        SUBSCRIBERS[project_id].remove(ws)

def append_log(project: ProjectState, agent: str, phase: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    try:
        safe_metadata = json.loads(redact_secrets(metadata or {}))
    except Exception:
        safe_metadata = {"redacted": redact_secrets(metadata or {})}
    log = {
        "id": str(uuid.uuid4()),
        "agent": agent,
        "phase": phase,
        "message": redact_secrets(message),
        "metadata": safe_metadata,
        "created_at": now_iso(),
    }
    project.logs.insert(0, log)
    project.logs = project.logs[:100]
    project.updated_at = now_iso()
    persist_activity_log(project, log)

def add_artifact(project: ProjectState, artifact_type: str, agent: str, title: str, content: Dict[str, Any], uri: Optional[str] = None) -> None:
    artifact = {
        "id": str(uuid.uuid4()),
        "type": artifact_type,
        "agent": agent,
        "title": title,
        "content": content,
        "uri": uri,
        "created_at": now_iso(),
    }
    project.artifacts.insert(0, artifact)
    project.artifacts = project.artifacts[:100]
    project.updated_at = now_iso()
    persist_artifact_record(project, artifact)
    try:
        indexed = index_artifact(project.id, artifact)
        if indexed:
            append_log(project, "system", "memory", f"Indexed {indexed} memory chunk(s) for artifact {title}.")
    except Exception as exc:
        append_log(project, "system", "memory", f"Artifact memory indexing failed: {exc}")

def persist_project(project: ProjectState) -> None:
    try:
        state_dump = project.model_dump_json()
        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            conn.execute(
                """
                INSERT INTO projects (id, name, client_goal, budget, status, current_phase, state_dump)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    client_goal = EXCLUDED.client_goal,
                    budget = EXCLUDED.budget,
                    status = EXCLUDED.status,
                    current_phase = EXCLUDED.current_phase,
                    state_dump = EXCLUDED.state_dump,
                    updated_at = NOW()
                """,
                (project.id, project.name, project.client_goal, project.budget, project.status, project.current_phase, state_dump),
            )
    except Exception as exc:
        append_log(project, "system", "storage", f"Knowledge DB persist failed: {exc}")

def load_projects() -> None:
    try:
        with psycopg.connect(db_dsn()) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT state_dump FROM projects")
                for (state_dump,) in cur:
                    if state_dump:
                        try:
                            # state_dump is parsed as dict by psycopg3 if JSONB, but model_dump_json() creates a string.
                            # So it could be a string or a dict.
                            state = ProjectState.model_validate(state_dump if isinstance(state_dump, dict) else json.loads(state_dump))
                            PROJECTS[state.id] = state
                            reindex_project_memory(state.id, state.artifacts)
                        except Exception as e:
                            print(f"Error loading project state: {e}")
    except Exception as exc:
        print(f"Failed to load projects from DB: {exc}")


def phase_ready(project: ProjectState, phase_id: str) -> bool:
    phase = project.phases[phase_id]
    return all(project.phases[dep]["status"] == "completed" for dep in phase["depends_on"])

def runnable_phases(project: ProjectState) -> List[str]:
    return [
        phase["id"]
        for phase in PHASES
        if project.phases[phase["id"]]["status"] == "pending" and phase_ready(project, phase["id"])
    ]

async def broadcast_token(project_id: str, phase_id: str, token: str) -> None:
    payload = json.dumps({"type": "token", "phase": phase_id, "token": token})
    for ws in SUBSCRIBERS.get(project_id, []):
        try:
            await ws.send_text(payload)
        except Exception:
            pass

async def artifact_for_phase(project: ProjectState, phase_id: str, agent_id: str, override_goal: str = None) -> Dict[str, Any]:
    agents = load_agents().get("agents", {})
    agent = agents.get(agent_id, {})
    
    async def log_callback(msg: str):
        append_log(project, agent_id, phase_id, msg)
        await publish(project.id)
        
    async def token_callback(token: str):
        await broadcast_token(project.id, phase_id, token)
        
    catalog = load_mcp_catalog()
    enabled_mcp = []
    disabled_mcp = []
    for name, srv in catalog.get("servers", {}).items():
        if srv.get("enabled", True):
            enabled_mcp.append(name)
            enabled_mcp.append(f"{name}_mcp")
        else:
            disabled_mcp.append(name)
            disabled_mcp.append(f"{name}_mcp")
            
    builtins = ["execute_command", "write_file", "read_file", "web_search", "get_weather", "convert_currency", "fetch_url", "download_resource", "generate_image", "edit_image", "knowledge_base"]
    enabled_mcp.extend(builtins)

    memory_context = retrieve_project_memory(
        project_id=project.id,
        phase_id=phase_id,
        query=f"{project.client_goal}\n{override_goal or ''}\n{agent.get('display_name', agent_id)}\n{' '.join(agent.get('deliverables', []))}",
    )
    if memory_context:
        append_log(project, "system", "memory", f"Retrieved {len(memory_context)} memory chunk(s) for {phase_id}.")
        
    return await generate_phase_artifact(
        phase_id=phase_id,
        agent_id=agent_id,
        agent=agent,
        project_name=project.name,
        client_goal=override_goal if override_goal else project.client_goal,
        budget=project.budget,
        existing_artifacts=project.artifacts,
        memory_context=memory_context if memory_context else None,
        on_tool_call=log_callback,
        on_token=token_callback,
        enabled_tools=enabled_mcp,
        disabled_tools=disabled_mcp
    )

async def execute_phase(project: ProjectState, phase_id: str) -> None:
    phase = project.phases[phase_id]
    agent_id = phase["agent"]
    phase["status"] = "running"
    phase["started_at"] = now_iso()
    project.current_phase = phase_id
    project.status = "running"
    append_log(project, agent_id, phase_id, f"{agent_id} started {phase_id}")
    upsert_phase_run(project, phase_id, "running")
    await publish(project.id)

    if phase_id == "founder_approval":
        project.status = "waiting_approval"
        append_log(project, "ceo", phase_id, "Contrato listo. Esperando aprobacion del fundador para continuar.")
        upsert_phase_run(project, phase_id, "waiting_approval")
        await publish(project.id)
        return

    try:
        goal_override = phase.get("goal_override")
        content = await artifact_for_phase(project, phase_id, agent_id, override_goal=goal_override)
    except Exception as exc:
        if agent_id != "debugger":
            append_log(project, "system", phase_id, f"⚠️ Error en {agent_id}. Invocando a Debugger Agent...")
            try:
                debugger_goal = f"FIX THIS ERROR for phase '{phase_id}' and agent '{agent_id}'. The error was:\n{exc}\n\nOriginal Project Goal: {project.client_goal}\nUse your tools to fix the code, dependencies or config. Once fixed, output your result."
                await artifact_for_phase(project, phase_id, "debugger", override_goal=debugger_goal)
                append_log(project, "debugger", phase_id, "✅ Error solucionado por Debugger. Reanudando agente original...")
                return await execute_phase(project, phase_id)
            except Exception as debugger_exc:
                phase["status"] = "failed"
                phase["error"] = f"Original error: {exc} | Debugger error: {debugger_exc}"
                upsert_phase_run(project, phase_id, "failed", error=phase["error"])
                project.status = "waiting_intervention"
                append_log(project, agent_id, phase_id, f"❌ Error crítico. Debugger falló: {debugger_exc}. Esperando intervención.")
                persist_project(project)
                await publish(project.id)
                return
        else:
            phase["status"] = "failed"
            phase["error"] = str(exc)
            upsert_phase_run(project, phase_id, "failed", error=phase["error"])
            project.status = "waiting_intervention"
            append_log(project, agent_id, phase_id, f"❌ Error en {agent_id} durante {phase_id}: {exc}. Esperando intervención del fundador.")
            persist_project(project)
            await publish(project.id)
            return

    add_artifact(
        project,
        artifact_type=phase_id,
        agent=agent_id,
        title=f"{phase_id.replace('_', ' ').title()} Artifact",
        content=content,
    )
    
    # Dynamic graph expansion
    next_inputs = content.get("next_required_inputs", [])
    if next_inputs:
        for required_agent in next_inputs:
            dynamic_phase_id = f"{required_agent}_{str(uuid.uuid4())[:8]}"
            project.phases[dynamic_phase_id] = {
                "id": dynamic_phase_id,
                "agent": required_agent,
                "depends_on": [phase_id],
                "status": "pending",
                "started_at": None,
                "completed_at": None,
                "error": None,
            }
            if "done" in project.phases and dynamic_phase_id not in project.phases["done"]["depends_on"]:
                project.phases["done"]["depends_on"].append(dynamic_phase_id)
            append_log(project, "system", "router", f"Dynamically added phase {dynamic_phase_id} for {required_agent}")
            
    phase["status"] = "completed"
    phase["completed_at"] = now_iso()
    persist_trace(project, phase_id, agent_id, "phase_completed", content)
    upsert_phase_run(project, phase_id, "completed", output=content)
    append_log(project, agent_id, phase_id, f"{agent_id} completed {phase_id}")
    limit = project_cost_limit()
    if limit and project_estimated_cost(project) > limit:
        project.status = "waiting_intervention"
        append_log(project, "system", "budget", f"Presupuesto de costo alcanzado: {project_estimated_cost(project)} USD > {limit} USD.")
        persist_project(project)
        await publish(project.id)
        return
    if phase_id == "done":
        project.status = "completed"
    persist_project(project)
    await publish(project.id)

async def run_project(project_id: str) -> None:
    project = PROJECTS[project_id]
    lock = RUN_LOCKS.setdefault(project_id, asyncio.Lock())
    async with lock:
        while project.status not in {"completed", "failed", "waiting_approval", "waiting_intervention"}:
            ready = runnable_phases(project)
            if not ready:
                project.status = "failed"
                append_log(project, "ceo", project.current_phase, "No runnable phases found. Check dependency state.")
                await publish(project.id)
                return

            if len(ready) > 1:
                await asyncio.gather(*(execute_phase(project, phase) for phase in ready))
            else:
                await execute_phase(project, ready[0])

            if project.status == "waiting_approval":
                return
