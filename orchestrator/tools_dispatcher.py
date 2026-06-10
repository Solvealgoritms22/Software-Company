import json
from typing import Dict, Any, Optional

from mcp_pool import call_stdio_tool
from tool_policy import evaluate_tool_policy
from tool_idempotency import complete_tool_call, fail_tool_call, reserve_tool_call

from tool_schemas import (
    CONFLUENCE_TOOLS_SCHEMA,
    DEPLOY_TOOLS_SCHEMA,
    GITHUB_TOOLS_SCHEMA,
    GOOGLE_DRIVE_TOOLS_SCHEMA,
    JIRA_TOOLS_SCHEMA,
    PLAYWRIGHT_TOOLS_SCHEMA,
    SECURITY_TOOLS_SCHEMA,
    WORKSPACE_TOOLS_SCHEMA,
)

class ToolDispatcher:
    
    @staticmethod
    async def dispatch(
        name: str,
        arguments: Dict[str, Any],
        agent_name: Optional[str] = None,
        project_id: Optional[str] = None,
        phase_id: Optional[str] = None,
    ) -> str:
        import json
        from config_manager import load_agents
        
        builtin_tools = {
            "execute_command", "write_file", "read_file", "fetch_url", "download_resource",
            "generate_image", "edit_image", "web_search", "get_weather", "convert_currency",
            "replace_file_content", "multi_replace_file_content", "grep_search", "list_dir"
        }
        prefix_tools = {
            "github_": {"github_mcp", "github"},
            "jira_": {"jira_mcp", "jira"},
            "confluence_": {"confluence_mcp", "confluence"},
            "google_drive_": {"google_drive_mcp", "google_drive"},
            "deploy_": {"deploy_mcp", "deploy", "vercel_cli", "railway_cli"},
            "playwright_": {"playwright_mcp", "playwright", "playwright_cli"},
            "security_": {"security_mcp", "security"},
        }
        allowed = set()
        if agent_name:
            agent_cfg = load_agents().get("agents", {}).get(agent_name, {})
            agent_tools = set(agent_cfg.get("tools", []))
            allowed.update(tool for tool in builtin_tools if tool in agent_tools)
            for prefix, contract_tools in prefix_tools.items():
                if agent_tools.intersection(contract_tools):
                    allowed.add(prefix)
        else:
            allowed.update(builtin_tools)
            allowed.update(prefix_tools.keys())

        is_allowed = name in allowed or any(name.startswith(prefix) for prefix in allowed if prefix.endswith("_"))
        if not is_allowed:
            return json.dumps({"error": f"Tool '{name}' is not allowed for agent '{agent_name}'."})

        policy = evaluate_tool_policy(name, arguments, agent_name=agent_name, project_id=project_id, phase_id=phase_id)
        if not policy["allowed"]:
            approval = policy.get("approval") or {}
            return json.dumps({
                "error": "Tool approval required",
                "approval_required": True,
                "approval_id": approval.get("id"),
                "tool_name": name,
                "risk": policy.get("risk"),
                "category": policy.get("category"),
                "reason": policy.get("reason"),
                "status": approval.get("status", "pending"),
            }, ensure_ascii=False)

        idempotency = reserve_tool_call(
            name,
            arguments,
            agent_name=agent_name,
            project_id=project_id,
            phase_id=phase_id,
        )
        if idempotency.get("hit"):
            return str(idempotency.get("result") or "")
        if idempotency.get("blocked"):
            return json.dumps({
                "error": "Duplicate tool call already running",
                "idempotency_blocked": True,
                "idempotency_key": idempotency.get("idempotency_key"),
                "reason": idempotency.get("reason"),
            }, ensure_ascii=False)
        
        server_dir = "workspace_tools"
        if name.startswith("github_"): server_dir = "github"
        elif name.startswith("jira_"): server_dir = "jira"
        elif name.startswith("confluence_"): server_dir = "confluence"
        elif name.startswith("google_drive_"): server_dir = "google_drive"
        elif name.startswith("deploy_"): server_dir = "deploy"
        elif name.startswith("playwright_"): server_dir = "playwright"
        elif name.startswith("security_"): server_dir = "security"
        
        payload = dict(arguments)
        if agent_name and name in ["github_commit_files", "jira_create_issue", "jira_add_comment", "confluence_create_page"]:
            payload["agent_name"] = agent_name

        def result_has_error(result: str) -> bool:
            try:
                obj = json.loads(result)
                if isinstance(obj, dict):
                    return bool(obj.get("error") or obj.get("Error"))
            except Exception:
                pass
            return result.startswith("Error calling ") or result.startswith("Error:")

        try:
            result = await call_stdio_tool(server_dir, name, payload)
            if result_has_error(result):
                fail_tool_call(idempotency.get("id"), result, result)
            else:
                complete_tool_call(idempotency.get("id"), result)
            if policy.get("approval_bypassed"):
                try:
                    data = json.loads(result)
                    if isinstance(data, dict):
                        data.setdefault("policy", {})
                        data["policy"]["approval_bypassed"] = True
                        data["policy"]["category"] = policy.get("category")
                        data["policy"]["risk"] = policy.get("risk")
                        return json.dumps(data, ensure_ascii=False)
                except Exception:
                    pass
            return result
        except Exception as e:
            error = f"Error calling {name} via pooled MCP stdio: {str(e)}"
            fail_tool_call(idempotency.get("id"), error, error)
            return error
