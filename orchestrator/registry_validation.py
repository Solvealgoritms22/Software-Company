import re
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional


IDENTIFIER_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{1,63}$")
BUILTIN_TOOLS = {
    "execute_command",
    "write_file",
    "read_file",
    "fetch_url",
    "download_resource",
    "generate_image",
    "edit_image",
    "web_search",
    "get_weather",
    "convert_currency",
    "ask_agent",
    "request_founder_intervention",
    "knowledge_base",
}


@dataclass
class ValidationReport:
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)

    @property
    def valid(self) -> bool:
        return not self.errors

    def add_error(self, message: str) -> None:
        self.errors.append(message)

    def add_warning(self, message: str) -> None:
        self.warnings.append(message)

    def extend(self, other: "ValidationReport") -> None:
        self.errors.extend(other.errors)
        self.warnings.extend(other.warnings)

    def as_dict(self) -> Dict[str, Any]:
        return {"valid": self.valid, "errors": self.errors, "warnings": self.warnings}


def clean_identifier(value: str, field_name: str = "id") -> str:
    cleaned = (value or "").strip()
    if not IDENTIFIER_RE.fullmatch(cleaned):
        raise ValueError(f"{field_name} must match {IDENTIFIER_RE.pattern}")
    return cleaned


def unique_clean_strings(values: Optional[Iterable[str]]) -> List[str]:
    seen: set[str] = set()
    result: List[str] = []
    for value in values or []:
        item = str(value).strip()
        if not item or item.lower() in seen:
            continue
        seen.add(item.lower())
        result.append(item)
    return result


def _detect_cycle(nodes: Iterable[str], parent_for: Dict[str, Optional[str]]) -> Optional[List[str]]:
    for node in nodes:
        seen: Dict[str, int] = {}
        current: Optional[str] = node
        while current:
            if current in seen:
                chain = list(seen.keys())[seen[current]:] + [current]
                return chain
            seen[current] = len(seen)
            current = parent_for.get(current)
    return None


def validate_departments(departments_data: Dict[str, Any]) -> ValidationReport:
    report = ValidationReport()
    departments = departments_data.get("departments") or {}
    parent_for: Dict[str, Optional[str]] = {}

    if not isinstance(departments, dict):
        report.add_error("departments must be an object")
        return report

    for dep_id, dep in departments.items():
        if not IDENTIFIER_RE.fullmatch(str(dep_id)):
            report.add_error(f"department '{dep_id}' has invalid id")
        if not isinstance(dep, dict):
            report.add_error(f"department '{dep_id}' must be an object")
            continue
        parent = dep.get("parent_id") or None
        if parent and parent not in departments:
            report.add_error(f"department '{dep_id}' references missing parent_id '{parent}'")
        if parent == dep_id:
            report.add_error(f"department '{dep_id}' cannot parent itself")
        parent_for[str(dep_id)] = parent

    cycle = _detect_cycle(departments.keys(), parent_for)
    if cycle:
        report.add_error(f"department parent cycle detected: {' -> '.join(cycle)}")
    return report


def validate_agent_registry(
    registry: Dict[str, Any],
    departments_data: Dict[str, Any],
    mcp_catalog: Dict[str, Any],
    strict_tools: bool = False,
) -> ValidationReport:
    report = ValidationReport()
    agents = registry.get("agents") or {}
    skills = {item.get("name") for item in registry.get("skills", []) if isinstance(item, dict)}
    deliverables = {item.get("code") for item in registry.get("deliverables", []) if isinstance(item, dict)}
    departments = departments_data.get("departments") or {}
    mcp_servers = set((mcp_catalog.get("servers") or {}).keys())
    tools_allowed = BUILTIN_TOOLS | mcp_servers
    reports_to: Dict[str, Optional[str]] = {}

    if not isinstance(agents, dict):
        report.add_error("agents must be an object")
        return report

    for agent_id, agent in agents.items():
        if not IDENTIFIER_RE.fullmatch(str(agent_id)):
            report.add_error(f"agent '{agent_id}' has invalid id")
        if not isinstance(agent, dict):
            report.add_error(f"agent '{agent_id}' must be an object")
            continue

        department_id = agent.get("department_id")
        if department_id and department_id not in departments:
            report.add_error(f"agent '{agent_id}' references missing department '{department_id}'")

        manager = agent.get("reports_to") or None
        if manager and manager not in agents:
            report.add_error(f"agent '{agent_id}' reports_to missing agent '{manager}'")
        if manager == agent_id:
            report.add_error(f"agent '{agent_id}' cannot report to itself")
        reports_to[str(agent_id)] = manager

        for skill in agent.get("skills", []) or []:
            if skills and skill not in skills:
                report.add_warning(f"agent '{agent_id}' references undeclared skill '{skill}'")
        for deliverable in agent.get("deliverables", []) or []:
            if deliverables and deliverable not in deliverables:
                report.add_warning(f"agent '{agent_id}' references undeclared deliverable '{deliverable}'")
        for tool in agent.get("tools", []) or []:
            if tool not in tools_allowed:
                message = f"agent '{agent_id}' references tool not in MCP catalog or builtin tools: '{tool}'"
                if strict_tools:
                    report.add_error(message)
                else:
                    report.add_warning(message)

    cycle = _detect_cycle(agents.keys(), reports_to)
    if cycle:
        report.add_error(f"agent reports_to cycle detected: {' -> '.join(cycle)}")
    return report


def validate_mcp_catalog(catalog: Dict[str, Any], registry: Dict[str, Any]) -> ValidationReport:
    report = ValidationReport()
    servers = catalog.get("servers") or {}
    agents = registry.get("agents") or {}

    if not isinstance(servers, dict):
        report.add_error("mcp servers must be an object")
        return report

    for server_name, server in servers.items():
        if not IDENTIFIER_RE.fullmatch(str(server_name)):
            report.add_error(f"MCP server '{server_name}' has invalid id")
        if not isinstance(server, dict):
            report.add_error(f"MCP server '{server_name}' must be an object")
            continue
        if server.get("enabled") and server.get("kind", "stdio") == "stdio" and not server.get("command"):
            report.add_error(f"enabled MCP server '{server_name}' requires command")
        for env_key in server.get("env_keys", []) or []:
            if not re.fullmatch(r"^[A-Z][A-Z0-9_]{1,127}$", str(env_key)):
                report.add_error(f"MCP server '{server_name}' has invalid env key '{env_key}'")
        for agent_id in server.get("required_for", []) or []:
            if agent_id not in agents:
                report.add_warning(f"MCP server '{server_name}' required_for references missing agent '{agent_id}'")
    return report


def validate_runtime_configuration(
    registry: Dict[str, Any],
    departments_data: Dict[str, Any],
    mcp_catalog: Dict[str, Any],
) -> ValidationReport:
    report = ValidationReport()
    report.extend(validate_departments(departments_data))
    report.extend(validate_agent_registry(registry, departments_data, mcp_catalog))
    report.extend(validate_mcp_catalog(mcp_catalog, registry))
    return report
