import os
import subprocess
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("deploy")

WORKSPACE_ROOT = Path(os.getenv("DEPLOY_WORKSPACE_ROOT", "C:\\ProgramData\\Software-Company\\workspace" if os.name == "nt" else "/workspace")).resolve()

def env(name: str, default: str = "") -> str:
    return os.getenv(name, default)

def safe_path(relative_path: str) -> Path:
    path = (WORKSPACE_ROOT / relative_path).resolve()
    if WORKSPACE_ROOT not in path.parents and path != WORKSPACE_ROOT:
        raise ValueError("project_path must stay inside DEPLOY_WORKSPACE_ROOT")
    return path

def run_command(command: List[str], cwd: Path, extra_env: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    if not cwd.exists():
        return {"error": f"Path does not exist: {cwd}"}
    env_vars = os.environ.copy()
    if extra_env:
        env_vars.update(extra_env)
    completed = subprocess.run(command, cwd=cwd, env=env_vars, capture_output=True, text=True, timeout=900)
    result = {
        "command": command,
        "cwd": str(cwd),
        "returncode": completed.returncode,
        "stdout": completed.stdout[-12000:],
        "stderr": completed.stderr[-12000:],
    }
    if completed.returncode != 0:
        result["error"] = "Command failed"
    return result

@mcp.tool()
def deploy_vercel(project_path: str = ".", production: bool = False, extra_args: str = "[]") -> str:
    """Despliega una aplicación frontend en Vercel. extra_args es JSON array."""
    try:
        if not env("VERCEL_TOKEN"):
            return json.dumps({"error": "VERCEL_TOKEN is not configured"})
            
        command = ["vercel", "deploy", "--token", env("VERCEL_TOKEN"), "--yes"]
        if production:
            command.append("--prod")
            
        args = json.loads(extra_args) if extra_args else []
        command.extend(args)
        
        result = run_command(command, safe_path(project_path))
        return json.dumps(result, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
def deploy_railway(project_path: str = ".", service: str = "", environment: str = "", extra_args: str = "[]") -> str:
    """Despliega un servicio backend en Railway. extra_args es JSON array."""
    try:
        token = env("RAILWAY_API_TOKEN") or env("RAILWAY_TOKEN")
        if not token:
            return json.dumps({"error": "RAILWAY_API_TOKEN or RAILWAY_TOKEN is not configured"})
            
        command = ["railway", "up", "--detach"]
        if service:
            command.extend(["--service", service])
        if environment:
            command.extend(["--environment", environment])
            
        args = json.loads(extra_args) if extra_args else []
        command.extend(args)
        
        result = run_command(command, safe_path(project_path), {"RAILWAY_TOKEN": token, "RAILWAY_API_TOKEN": token})
        return json.dumps(result, ensure_ascii=False)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

