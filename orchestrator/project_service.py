import asyncio
import uuid
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import WebSocket

from models import ProjectState
from artifact_memory import index_artifact, retrieve_project_memory
from llm_client import generate_phase_artifact
from config_manager import load_agents, load_mcp_catalog, load_departments
from project_graph import assert_phase_graph_valid
from project_pubsub import send_project_state, send_project_token
from registry_validation import clean_identifier, validate_runtime_configuration
from semantic_cache import (
    reusable_semantic_phase_output,
    retrieve_semantic_phase_cache,
    store_semantic_phase_cache,
)
from token_budget import project_cost_limit, redact_secrets
from project_store import load_projects_into, persist_project_state

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

PROJECTS: Dict[str, ProjectState] = {}
SUBSCRIBERS: Dict[str, List[WebSocket]] = {}
RUN_LOCKS: Dict[str, asyncio.Lock] = {}
PROJECT_TASKS: Dict[str, asyncio.Task] = {}

def schedule_project_run(project_id: str) -> asyncio.Task:
    existing = PROJECT_TASKS.get(project_id)
    if existing and not existing.done():
        return existing

    task = asyncio.create_task(run_project(project_id), name=f"project-run:{project_id}")
    PROJECT_TASKS[project_id] = task

    def cleanup(done: asyncio.Task) -> None:
        if PROJECT_TASKS.get(project_id) is done:
            PROJECT_TASKS.pop(project_id, None)

    task.add_done_callback(cleanup)
    return task

def cancel_project_run(project_id: str) -> None:
    task = PROJECT_TASKS.get(project_id)
    if task and not task.done():
        task.cancel()

from project_config import PHASES, build_initial_phases, max_dynamic_phases_per_output, max_project_phases

from project_persistence import (
    delete_phase_checkpoints,
    list_project_traces,
    load_phase_checkpoint,
    persist_activity_log,
    persist_artifact_record,
    persist_phase_contract_eval,
    persist_phase_quality_eval,
    persist_retrieval_eval,
    persist_trace,
    project_estimated_cost,
    project_usage_summary,
    upsert_phase_run,
)

async def publish(project_id: str) -> None:
    state = PROJECTS.get(project_id)
    if not state:
        return
    await send_project_state(project_id, state, SUBSCRIBERS)

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


def restore_phase_checkpoint(project: ProjectState, phase_id: str, agent_id: str, checkpoint: Dict[str, Any]) -> None:
    phase = project.phases[phase_id]
    if not any(artifact.get("type") == phase_id for artifact in project.artifacts):
        add_artifact(
            project,
            artifact_type=phase_id,
            agent=agent_id,
            title=f"{phase_id.replace('_', ' ').title()} Artifact",
            content=checkpoint,
        )
    phase["status"] = "completed"
    phase["started_at"] = phase.get("started_at") or now_iso()
    phase["completed_at"] = phase.get("completed_at") or now_iso()
    phase["error"] = None
    persist_trace(
        project,
        phase_id,
        agent_id,
        "phase_checkpoint_reused",
        {"metadata": {"summary": "Reused persisted phase checkpoint without model call."}},
    )
    upsert_phase_run(project, phase_id, "completed", output=checkpoint)
    append_log(project, "system", phase_id, f"Checkpoint reutilizado para {phase_id}; se omitio llamada al modelo.")

def persist_project(project: ProjectState) -> None:
    try:
        persist_project_state(project)
    except Exception as exc:
        append_log(project, "system", "storage", f"Knowledge DB persist failed: {exc}")


def load_projects() -> None:
    load_projects_into(PROJECTS)


def phase_ready(project: ProjectState, phase_id: str) -> bool:
    phase = project.phases[phase_id]
    return all(project.phases[dep]["status"] == "completed" for dep in phase["depends_on"])

def runnable_phases(project: ProjectState) -> List[str]:
    # IDs of static phases
    static_phase_ids = {phase["id"] for phase in PHASES}

    # Static phases that are pending and ready
    static_ready = [
        phase["id"]
        for phase in PHASES
        if phase["id"] in project.phases
        and project.phases[phase["id"]]["status"] == "pending"
        and phase_ready(project, phase["id"])
    ]

    # Dynamic phases (e.g. chat iteration phases) not in the static list
    dynamic_ready = [
        phase_id
        for phase_id, phase in project.phases.items()
        if phase_id not in static_phase_ids
        and phase["status"] == "pending"
        and phase_ready(project, phase_id)
    ]

    return static_ready + dynamic_ready


def assert_runtime_configuration_valid() -> None:
    report = validate_runtime_configuration(load_agents(), load_departments(), load_mcp_catalog())
    if not report.valid:
        raise RuntimeError(f"Invalid factory configuration: {json.dumps(report.as_dict(), ensure_ascii=False)}")


def assert_project_graph_valid(project: ProjectState) -> None:
    assert_phase_graph_valid(project.phases or {}, load_agents().get("agents", {}), max_project_phases())


async def broadcast_token(project_id: str, phase_id: str, token: str) -> None:
    await send_project_token(project_id, phase_id, token, SUBSCRIBERS)

async def artifact_for_phase(project: ProjectState, phase_id: str, agent_id: str, override_goal: str = None) -> Dict[str, Any]:
    agents = load_agents().get("agents", {})
    agent = agents.get(agent_id, {})
    query_text = f"{project.client_goal}\n{override_goal or ''}\n{agent.get('display_name', agent_id)}\n{' '.join(agent.get('deliverables', []))}"
    
    async def log_callback(msg: str):
        append_log(project, agent_id, phase_id, msg)
        persist_trace(
            project,
            phase_id,
            agent_id,
            "tool_event",
            {"metadata": {"message": msg}},
        )
        await publish(project.id)
        
    async def token_callback(token: str):
        await broadcast_token(project.id, phase_id, token)

    async def trace_callback(event_type: str, metadata: Dict[str, Any]):
        content = {"metadata": metadata}
        if event_type == "llm_call":
            content["model"] = metadata.get("model")
            content["provider"] = metadata.get("provider")
        persist_trace(
            project,
            phase_id,
            agent_id,
            event_type,
            content,
        )
        await publish(project.id)
        
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

    cached_output = reusable_semantic_phase_output(project.id, phase_id, agent_id, query_text)
    if cached_output:
        persist_trace(
            project,
            phase_id,
            agent_id,
            "semantic_cache_reused",
            {"metadata": {"exact_match": True, "summary": cached_output.get("summary")}},
        )
        append_log(project, "system", "semantic_cache", f"Reused exact semantic cache for {phase_id}; model call skipped.")
        return cached_output

    memory_context = retrieve_project_memory(
        project_id=project.id,
        phase_id=phase_id,
        query=query_text,
    )
    semantic_context = retrieve_semantic_phase_cache(project.id, phase_id, agent_id, query_text)
    combined_context = [*semantic_context, *memory_context]
    if semantic_context:
        token_estimate = sum(int(item.get("token_estimate") or 0) for item in semantic_context)
        append_log(project, "system", "semantic_cache", f"Retrieved {len(semantic_context)} semantic cache item(s) for {phase_id}.")
        persist_trace(
            project,
            phase_id,
            agent_id,
            "semantic_cache_retrieved",
            {
                "metadata": {
                    "items": len(semantic_context),
                    "token_estimate": token_estimate,
                    "citations": [item.get("citation") for item in semantic_context if item.get("citation")],
                    "scores": [
                        {
                            "citation": item.get("citation"),
                            "score": item.get("score"),
                            "lexical_score": item.get("lexical_score"),
                            "vector_score": item.get("vector_score"),
                            "exact_match": item.get("exact_match"),
                        }
                        for item in semantic_context
                    ],
                }
            },
        )
    if memory_context:
        token_estimate = sum(int(item.get("token_estimate") or 0) for item in memory_context)
        candidate_tokens = sum(int(item.get("candidate_token_estimate") or item.get("token_estimate") or 0) for item in memory_context)
        append_log(project, "system", "memory", f"Retrieved {len(memory_context)} memory chunk(s) for {phase_id}.")
        persist_trace(
            project,
            phase_id,
            agent_id,
            "memory_retrieved",
            {
                "metadata": {
                    "chunks": len(memory_context),
                    "token_estimate": token_estimate,
                    "candidate_tokens": candidate_tokens,
                    "citations": [item.get("citation") for item in memory_context if item.get("citation")],
                    "memory_ids": [item.get("memory_id") for item in memory_context if item.get("memory_id")],
                    "scores": [
                        {
                            "citation": item.get("citation"),
                            "score": item.get("score"),
                            "lexical_score": item.get("lexical_score"),
                            "vector_score": item.get("vector_score"),
                        }
                        for item in memory_context
                    ],
                }
            },
        )
        
    return await generate_phase_artifact(
        phase_id=phase_id,
        agent_id=agent_id,
        agent=agent,
        project_name=project.name,
        client_goal=override_goal if override_goal else project.client_goal,
        budget=project.budget,
        existing_artifacts=project.artifacts,
        memory_context=combined_context if combined_context else None,
        on_tool_call=log_callback,
        on_trace=trace_callback,
        on_token=token_callback,
        enabled_tools=enabled_mcp,
        disabled_tools=disabled_mcp,
        project_id=project.id,
    )

async def execute_phase(project: ProjectState, phase_id: str) -> None:
    phase = project.phases[phase_id]
    agent_id = phase["agent"]
    if not phase.get("goal_override"):
        checkpoint = load_phase_checkpoint(project.id, phase_id)
        if checkpoint:
            restore_phase_checkpoint(project, phase_id, agent_id, checkpoint)
            persist_project(project)
            await publish(project.id)
            return

    phase["status"] = "running"
    phase["started_at"] = now_iso()
    project.current_phase = phase_id
    project.status = "running"
    append_log(project, agent_id, phase_id, f"{agent_id} started {phase_id}")
    persist_trace(project, phase_id, agent_id, "phase_started", {"metadata": {"status": "running"}})
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
        error_message = str(exc)
        if error_message.startswith("TOOL_APPROVAL_REQUIRED:"):
            phase["status"] = "failed"
            phase["error"] = error_message.replace("TOOL_APPROVAL_REQUIRED: ", "", 1)
            upsert_phase_run(project, phase_id, "failed", error=phase["error"])
            persist_trace(project, phase_id, agent_id, "tool_approval_required", {"metadata": {"error": phase["error"]}})
            project.status = "waiting_intervention"
            append_log(project, "tool_policy", phase_id, f"Aprobacion requerida antes de continuar: {phase['error']}")
            persist_project(project)
            await publish(project.id)
            return
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
                persist_trace(project, phase_id, agent_id, "phase_failed", {"metadata": {"error": phase["error"]}})
                project.status = "waiting_intervention"
                append_log(project, agent_id, phase_id, f"❌ Error crítico. Debugger falló: {debugger_exc}. Esperando intervención.")
                persist_project(project)
                await publish(project.id)
                return
        else:
            phase["status"] = "failed"
            phase["error"] = str(exc)
            upsert_phase_run(project, phase_id, "failed", error=phase["error"])
            persist_trace(project, phase_id, agent_id, "phase_failed", {"metadata": {"error": phase["error"]}})
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
    if next_inputs and not isinstance(next_inputs, list):
        append_log(project, "system", "router", "Ignored invalid next_required_inputs: expected a list.")
        next_inputs = []
    if next_inputs:
        agents_catalog = load_agents().get("agents", {})
        normalized_required_agents: List[str] = []
        for raw_agent in next_inputs[:max_dynamic_phases_per_output()]:
            try:
                required_agent = clean_identifier(str(raw_agent).strip(), "required agent")
            except ValueError:
                append_log(project, "system", "router", f"Ignored invalid dynamic phase agent reference: {raw_agent}")
                continue
            if required_agent not in agents_catalog:
                append_log(project, "system", "router", f"Ignored dynamic phase for unknown agent: {required_agent}")
                continue
            if required_agent not in normalized_required_agents:
                normalized_required_agents.append(required_agent)

        if len(next_inputs) > max_dynamic_phases_per_output():
            append_log(
                project,
                "system",
                "router",
                f"Dynamic phase request truncated to {max_dynamic_phases_per_output()} item(s).",
            )

        if len(project.phases) + len(normalized_required_agents) > max_project_phases():
            raise RuntimeError(
                f"Dynamic phase expansion would exceed MAX_PROJECT_PHASES={max_project_phases()}"
            )

        for required_agent in normalized_required_agents:
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
        assert_project_graph_valid(project)
            
    phase["status"] = "completed"
    phase["completed_at"] = now_iso()
    persist_trace(project, phase_id, agent_id, "phase_completed", content)
    persist_retrieval_eval(project, phase_id, agent_id, content)
    persist_phase_contract_eval(project, phase_id, agent_id, content)
    persist_phase_quality_eval(project, phase_id, agent_id, content)
    upsert_phase_run(project, phase_id, "completed", output=content)
    try:
        agent_cfg = load_agents().get("agents", {}).get(agent_id, {})
        cache_query = f"{project.client_goal}\n{phase.get('goal_override') or ''}\n{agent_cfg.get('display_name', agent_id)}\n{' '.join(agent_cfg.get('deliverables', []))}"
        store_semantic_phase_cache(project.id, phase_id, agent_id, cache_query, content)
        persist_trace(
            project,
            phase_id,
            agent_id,
            "semantic_cache_stored",
            {
                "metadata": {
                    "citations": content.get("citations", []),
                    "summary": content.get("summary"),
                }
            },
        )
    except Exception:
        pass
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
    task = asyncio.current_task()
    PROJECT_TASKS[project_id] = task
    
    try:
        assert_runtime_configuration_valid()
        assert_project_graph_valid(project)
        async with lock:
            while project.status not in {"completed", "failed", "waiting_approval", "waiting_intervention"}:
                assert_project_graph_valid(project)
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
    except asyncio.CancelledError:
        append_log(project, "system", "control", "Proceso de orquestación abortado (CancelledError).")
        raise
    except Exception as exc:
        project.status = "waiting_intervention"
        append_log(project, "system", "factory_validation", f"Factory execution stopped: {exc}")
        persist_project(project)
        await publish(project.id)
    finally:
        if PROJECT_TASKS.get(project_id) == task:
            del PROJECT_TASKS[project_id]
