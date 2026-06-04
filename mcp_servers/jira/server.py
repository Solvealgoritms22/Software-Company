import os
import json
from typing import Any, Dict, List, Optional
import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("jira")

def env(name: str, default: str = "") -> str:
    return os.getenv(name, default)

def jira_base() -> str:
    return env("JIRA_URL").rstrip("/")

def jira_auth() -> tuple[str, str]:
    return (env("JIRA_USER"), env("JIRA_API_TOKEN"))

def require_config() -> None:
    missing = [name for name in ["JIRA_URL", "JIRA_USER", "JIRA_API_TOKEN"] if not env(name)]
    if missing:
        raise ValueError(f"Missing Jira config: {', '.join(missing)}")

def adf_text(text: str) -> Dict[str, Any]:
    return {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "paragraph",
                "content": [{"type": "text", "text": text or " "}],
            }
        ],
    }

@mcp.tool()
async def jira_create_issue(summary: str, description: str = "", issue_type: str = "Task", project_key: str = "", labels: str = "[]", agent_name: str = "") -> str:
    """Crea un nuevo ticket/incidencia en Jira. labels es un JSON array str."""
    try:
        require_config()
        pkey = project_key or env("JIRA_PROJECT_KEY")
        if not pkey:
            return json.dumps({"error": "project_key or JIRA_PROJECT_KEY is required"})
            
        desc = description
        if agent_name:
            desc = f"{desc}\n\n---\nCreado por {agent_name}"
            
        parsed_labels = json.loads(labels) if labels else []
        
        payload = {
            "fields": {
                "project": {"key": pkey},
                "summary": summary,
                "description": adf_text(desc),
                "issuetype": {"name": issue_type},
                "labels": parsed_labels,
            }
        }
        async with httpx.AsyncClient(timeout=20.0, auth=jira_auth()) as client:
            response = await client.post(f"{jira_base()}/rest/api/3/issue", json=payload)
        
        if response.status_code >= 400:
            return json.dumps({"error": response.text})
        return json.dumps(response.json())
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
async def jira_add_comment(issue_key: str, body: str, agent_name: str = "") -> str:
    """Añade un comentario a un ticket existente de Jira."""
    try:
        require_config()
        text = body
        if agent_name:
            text = f"{text}\n\n---\nComentario por {agent_name}"
            
        async with httpx.AsyncClient(timeout=20.0, auth=jira_auth()) as client:
            response = await client.post(
                f"{jira_base()}/rest/api/3/issue/{issue_key}/comment",
                json={"body": adf_text(text)},
            )
        if response.status_code >= 400:
            return json.dumps({"error": response.text})
        return json.dumps(response.json())
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
async def jira_transition_issue(issue_key: str, transition_id: str) -> str:
    """Transiciona el estado de un ticket en Jira."""
    try:
        require_config()
        async with httpx.AsyncClient(timeout=20.0, auth=jira_auth()) as client:
            response = await client.post(
                f"{jira_base()}/rest/api/3/issue/{issue_key}/transitions",
                json={"transition": {"id": transition_id}},
            )
        if response.status_code >= 400:
            return json.dumps({"error": response.text})
        return json.dumps({"status": "ok"})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

