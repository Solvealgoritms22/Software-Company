import os
import json
from typing import Any, Dict, Optional
import httpx
import markdown
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("confluence", dependencies=["markdown"])

def env(name: str, default: str = "") -> str:
    return os.getenv(name, default)

def jira_base() -> str:
    return env("JIRA_URL").rstrip("/")

def confluence_base() -> str:
    configured = env("CONFLUENCE_URL").rstrip("/")
    if configured:
        return configured
    return f"{jira_base()}/wiki"

def auth() -> tuple[str, str]:
    return (env("JIRA_USER"), env("JIRA_API_TOKEN"))

def require_config() -> None:
    missing = [name for name in ["JIRA_URL", "JIRA_USER", "JIRA_API_TOKEN"] if not env(name)]
    if missing:
        raise ValueError(f"Missing Confluence config: {', '.join(missing)}")

@mcp.tool()
async def confluence_create_page(title: str, markdown_body: str, html_body: str = "", space_key: str = "", parent_id: str = "", agent_name: str = "") -> str:
    """Crea y publica una nueva página en Confluence con contenido técnico o de negocio."""
    try:
        require_config()
        skey = space_key or env("CONFLUENCE_SPACE_KEY")
        if not skey:
            return json.dumps({"error": "space_key or CONFLUENCE_SPACE_KEY is required"})
            
        html = html_body or markdown.markdown(markdown_body)
        if agent_name:
            html += f"<hr /><p><em>Creado por {agent_name}</em></p>"
            
        ancestors = [{"id": parent_id}] if parent_id else []
        payload = {
            "type": "page",
            "title": title,
            "space": {"key": skey},
            "ancestors": ancestors,
            "body": {"storage": {"value": html, "representation": "storage"}},
        }
        
        async with httpx.AsyncClient(timeout=20.0, auth=auth()) as client:
            response = await client.post(f"{confluence_base()}/rest/api/content", json=payload)
            
        if response.status_code >= 400:
            return json.dumps({"error": response.text})
        return json.dumps(response.json())
    except Exception as exc:
        return json.dumps({"error": str(exc)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

