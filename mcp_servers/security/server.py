import json
import os
import subprocess
from pathlib import Path
from typing import Any, Dict, List
import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("security")

WORKSPACE_ROOT = Path(os.getenv("SECURITY_WORKSPACE_ROOT", "C:\\ProgramData\\Software-Company\\workspace" if os.name == "nt" else "/workspace")).resolve()

def safe_path(relative_path: str) -> Path:
    path = (WORKSPACE_ROOT / relative_path).resolve()
    if WORKSPACE_ROOT not in path.parents and path != WORKSPACE_ROOT:
        raise ValueError("project_path must stay inside SECURITY_WORKSPACE_ROOT")
    return path

def run_command(command: List[str], cwd: Path, allow_nonzero: bool = True) -> Dict[str, Any]:
    if not cwd.exists():
        return {"error": f"Path does not exist: {cwd}"}
    completed = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=900)
    result = {
        "command": command,
        "cwd": str(cwd),
        "returncode": completed.returncode,
        "stdout": completed.stdout[-20000:],
        "stderr": completed.stderr[-20000:],
    }
    if completed.returncode != 0 and not allow_nonzero:
        result["error"] = "Command failed"
    return result

@mcp.tool()
def security_python_bandit(project_path: str = ".", extra_args: str = "[]") -> str:
    """Ejecuta un escaneo de seguridad de código Python usando Bandit. extra_args es un JSON array."""
    try:
        command = ["bandit", "-r", ".", "-f", "json"]
        args = json.loads(extra_args) if extra_args else []
        command.extend(args)
        result = run_command(command, safe_path(project_path), allow_nonzero=True)
        try:
            result["report"] = json.loads(result["stdout"]) if result.get("stdout") else {}
        except json.JSONDecodeError:
            result["report"] = {}
        return json.dumps(result, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
def security_node_npm_audit(project_path: str = ".", extra_args: str = "[]") -> str:
    """Ejecuta un escaneo de dependencias vulnerables de Node.js usando npm audit."""
    try:
        command = ["npm", "audit", "--json"]
        args = json.loads(extra_args) if extra_args else []
        command.extend(args)
        result = run_command(command, safe_path(project_path), allow_nonzero=True)
        try:
            result["report"] = json.loads(result["stdout"]) if result.get("stdout") else {}
        except json.JSONDecodeError:
            result["report"] = {}
        return json.dumps(result, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
async def security_zap_baseline(target_url: str, zap_api_url: str = "") -> str:
    """Ejecuta un escaneo de seguridad baseline contra una URL usando OWASP ZAP."""
    try:
        api_url = (zap_api_url or os.getenv("ZAP_API_URL", "")).rstrip("/")
        if not api_url:
            return json.dumps({"error": "ZAP_API_URL is not configured"})
            
        async with httpx.AsyncClient(timeout=60.0) as client:
            spider = await client.get(f"{api_url}/JSON/spider/action/scan/", params={"url": target_url})
            if spider.status_code >= 400:
                return json.dumps({"error": spider.text})
                
            alerts = await client.get(f"{api_url}/JSON/core/view/alerts/", params={"baseurl": target_url})
            if alerts.status_code >= 400:
                return json.dumps({"error": alerts.text})
                
        return json.dumps({"target_url": target_url, "spider": spider.json(), "alerts": alerts.json()})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

