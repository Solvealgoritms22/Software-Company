import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from token_budget import select_relevant_artifacts


ROOT = Path(__file__).resolve().parent
APP_ROOT = ROOT if (ROOT / "config").exists() else ROOT.parent
SETTINGS_PATH = APP_ROOT / "config" / "settings.json"


def load_system_prompt_mcp_instructions(project_name: str = "default_project") -> str:
    default_prompt = (
        "IMPORTANTE SOBRE HERRAMIENTAS Y MCP:\n"
        "1. Tienes acceso a herramientas avanzadas si estan configuradas. Usalas estrictamente para interactuar con el entorno.\n"
        "2. GitHub (github_mcp): si vas a crear un repositorio o rama, primero verifica si ya existe o intenta leerlo.\n"
        "3. Jira (jira_mcp): si vas a crear una epica o tarea, asume que el tablero ya existe y no dupliques trabajo existente.\n"
        "4. Google Drive (google_drive_mcp): si tienes esta herramienta, sube contratos, PDFs o entregables finales a Google Drive.\n"
        "5. Pruebas de interfaz: si tienes `playwright_cli` o `playwright_mcp`, corre pruebas de humo reales sobre el sitio desplegado.\n"
        "6. Seguridad: si tienes `security_mcp` activo, ejecuta bandit_scan y npm_audit en el workspace.\n"
        "7. Despliegues: si tienes `deploy_mcp` activo, corre el despliegue configurado y reporta el resultado real.\n"
        "8. Bloqueos y errores: si una herramienta falla, intenta alternativas hasta 3 veces. Si faltan credenciales, llama a `request_founder_intervention`.\n"
        "9. No inventes ni simules acciones externas: usa herramientas MCP reales y reporta identificadores o URLs resultantes.\n"
        f"10. Aislamiento de workspace: todo codigo, comandos y archivos deben realizarse dentro de `./{project_name}`. Si no existe, crealo antes de empezar.\n"
        "11. Comparte contexto y evita duplicados: lee los existing_artifacts y reusa recursos creados por fases anteriores.\n"
        "12. Tras un error de herramienta, verifica el estado del sistema antes de repetir la accion.\n\n"
        "You must produce real, implementation-oriented deliverables. Do not invent completed external actions unless a tool result is provided."
    )
    if not SETTINGS_PATH.exists():
        return default_prompt
    try:
        data = json.loads(SETTINGS_PATH.read_text(encoding="utf-8"))
        return data.get("system_prompt_mcp_instructions") or default_prompt
    except Exception:
        return default_prompt


def build_system_prompt(
    agent_id: str,
    agent: Dict[str, Any],
    project_name: str,
    enabled_tools: Optional[List[str]] = None,
    disabled_tools: Optional[List[str]] = None,
) -> str:
    skills = "\n".join(f"- {skill}" for skill in agent.get("skills", []))
    enabled_tool_set = set(enabled_tools) if enabled_tools is not None else None
    disabled_tools = disabled_tools or []
    active_tools: List[str] = []
    inactive_tools: List[str] = []

    alias_groups = {
        "github_mcp": {"github"},
        "jira_mcp": {"jira"},
        "confluence_mcp": {"confluence"},
        "google_drive_mcp": {"google_drive"},
        "deploy_mcp": {"deploy"},
        "playwright_mcp": {"playwright"},
        "playwright_cli": {"playwright", "playwright_mcp"},
        "security_mcp": {"security"},
    }

    def is_enabled_tool(tool_name: str) -> bool:
        if enabled_tool_set is None or tool_name in enabled_tool_set:
            return True
        return bool(alias_groups.get(tool_name, set()).intersection(enabled_tool_set))

    for tool in agent.get("tools", []):
        if is_enabled_tool(tool):
            active_tools.append(tool)
        elif tool in disabled_tools:
            inactive_tools.append(tool)
        else:
            inactive_tools.append(f"{tool} (NO IMPLEMENTADO EN EL DISPATCHER)")

    tools_str = "\n".join(f"- {tool}" for tool in active_tools)
    inactive_str = "\n".join(f"- {tool} (DESACTIVADO - NO USAR)" for tool in inactive_tools)
    deliverables = "\n".join(f"- {item}" for item in agent.get("deliverables", []))
    display_name = agent.get("display_name", agent_id)
    instructions = load_system_prompt_mcp_instructions(project_name=project_name)

    prompt = f"""You are {display_name} in a multi-agent software company.

{instructions}

Skills:
{skills}

Available tools by contract (ACTIVE):
{tools_str}
"""
    if inactive_tools:
        prompt += f"""
Deactivated tools (DO NOT USE, they are turned off in settings):
{inactive_str}
"""

    prompt += f"""
Expected deliverables:
{deliverables}

You MUST use your active tools and skills to complete your expected deliverables.
Return strict JSON with these keys:
- summary: concise Spanish summary of what you produced.
- deliverables: object keyed by deliverable name containing the content for each expected deliverable.
- risks: array of concrete risks or blockers.
- next_required_inputs: array of information needed by dependent agents.
- citations: array of citation ids from existing_artifacts that you used, for example artifact:<artifact_id>#chunk:<chunk>.
"""
    return prompt


def build_user_prompt(
    phase_id: str,
    project_name: str,
    client_goal: str,
    budget: Optional[str],
    existing_artifacts: List[Dict[str, Any]],
    memory_context: Optional[List[Dict[str, Any]]] = None,
) -> str:
    artifact_context = memory_context if memory_context is not None else select_relevant_artifacts(phase_id, client_goal, existing_artifacts)
    return json.dumps(
        {
            "phase": phase_id,
            "project_name": project_name,
            "client_goal": client_goal,
            "budget_or_constraints": budget,
            "existing_artifacts": artifact_context,
            "context_policy": "existing_artifacts contains compacted RAG memory chunks, not full artifacts. Each memory chunk includes citation, artifact_id and chunk. Use read_file or a specific tool only when exact content is required.",
            "citation_policy": "When you rely on an item from existing_artifacts, include its citation value in the output citations array. Do not cite sources that are not present in existing_artifacts.",
            "instruction": "Produce the artifact for this phase in Spanish. Keep it concrete, compact and usable by the next agent.",
        },
        ensure_ascii=True,
    )
