from typing import Any, Dict, List, Optional

from tools_dispatcher import (
    CONFLUENCE_TOOLS_SCHEMA,
    DEPLOY_TOOLS_SCHEMA,
    GITHUB_TOOLS_SCHEMA,
    GOOGLE_DRIVE_TOOLS_SCHEMA,
    JIRA_TOOLS_SCHEMA,
    PLAYWRIGHT_TOOLS_SCHEMA,
    SECURITY_TOOLS_SCHEMA,
    WORKSPACE_TOOLS_SCHEMA,
)


def build_available_tools(agent: Dict[str, Any], enabled_tools: Optional[List[str]]) -> List[Dict[str, Any]]:
    available_tools: List[Dict[str, Any]] = []
    agent_tools = agent.get("tools", [])

    for tool_schema in WORKSPACE_TOOLS_SCHEMA:
        tool_name = tool_schema["function"]["name"]
        if tool_name in agent_tools and (enabled_tools is None or tool_name in enabled_tools):
            available_tools.append(tool_schema)

    if "github_mcp" in agent_tools and _enabled(enabled_tools, "github_mcp", "github"):
        available_tools.extend(GITHUB_TOOLS_SCHEMA)
    if "jira_mcp" in agent_tools and _enabled(enabled_tools, "jira_mcp", "jira"):
        available_tools.extend(JIRA_TOOLS_SCHEMA)
    if "confluence_mcp" in agent_tools and _enabled(enabled_tools, "confluence_mcp", "confluence"):
        available_tools.extend(CONFLUENCE_TOOLS_SCHEMA)
    if "google_drive_mcp" in agent_tools and _enabled(enabled_tools, "google_drive_mcp", "google_drive"):
        available_tools.extend(GOOGLE_DRIVE_TOOLS_SCHEMA)
    if "deploy_mcp" in agent_tools and _enabled(enabled_tools, "deploy_mcp", "deploy"):
        available_tools.extend(DEPLOY_TOOLS_SCHEMA)
    if ("playwright_cli" in agent_tools or "playwright_mcp" in agent_tools) and _enabled(enabled_tools, "playwright_cli", "playwright"):
        available_tools.extend(PLAYWRIGHT_TOOLS_SCHEMA)
    if "security_mcp" in agent_tools and _enabled(enabled_tools, "security_mcp", "security"):
        available_tools.extend(SECURITY_TOOLS_SCHEMA)

    return available_tools


def _enabled(enabled_tools: Optional[List[str]], *aliases: str) -> bool:
    if enabled_tools is None:
        return True
    return any(alias in enabled_tools for alias in aliases)
