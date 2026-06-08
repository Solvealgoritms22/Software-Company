import os
from pathlib import Path
from typing import Dict, Any, Literal
from fastapi import APIRouter, HTTPException

from models import McpServerUpdate, SecretUpdate
from config_manager import (
    load_mcp_catalog, save_mcp_catalog, 
    load_secret_store, save_secret_store,
    declared_secret_keys, secret_status, export_mcp_config,
    load_agents, save_agents, load_departments
)
from registry_validation import validate_mcp_catalog, validate_runtime_configuration

router = APIRouter(prefix="/mcp", tags=["mcp"])

APP_ROOT = Path(__file__).resolve().parents[2]
LOCAL_SERVER_DIRS = {
    "github_mcp": "github",
    "jira_mcp": "jira",
    "confluence_mcp": "confluence",
    "google_drive_mcp": "google_drive",
    "deploy_mcp": "deploy",
    "playwright_mcp": "playwright",
    "security_mcp": "security",
    "workspace_tools": "workspace_tools",
}


def local_server_script(server_name: str) -> Path:
    server_dir = LOCAL_SERVER_DIRS.get(server_name, server_name.removesuffix("_mcp"))
    return APP_ROOT / "mcp_servers" / server_dir / "server.py"


def server_uses_local_backend(server_name: str, server: Dict[str, Any]) -> bool:
    command = str(server.get("command") or "").lower()
    args = [str(arg).replace("\\", "/") for arg in server.get("args", []) or []]
    if any("mcp_servers/" in arg for arg in args):
        return True
    return server_name in LOCAL_SERVER_DIRS and command in {"python", "python.exe", "py"}


def assert_backend_implemented(server_name: str, server: Dict[str, Any] | None = None) -> None:
    server = server or {}
    if not server_uses_local_backend(server_name, server):
        return
    script_path = local_server_script(server_name)
    if not script_path.exists():
        raise HTTPException(
            status_code=400,
            detail=f"MCP server '{server_name}' has no local backend implementation at {script_path.relative_to(APP_ROOT)}",
        )


def sync_server_required_agents(server_name: str, server: Dict[str, Any]) -> None:
    required_agents = server.get("required_for", [])
    if required_agents is None:
        return
    registry = load_agents()
    agents_map = registry.setdefault("agents", {})
    for agent_id, agent_data in agents_map.items():
        agent_tools = agent_data.setdefault("tools", [])
        if agent_id in required_agents:
            if server_name not in agent_tools:
                agent_tools.append(server_name)
        elif server_name in agent_tools:
            agent_data["tools"] = [tool for tool in agent_tools if tool != server_name]
    save_agents(registry)

@router.get("/status")
async def mcp_status() -> Dict[str, Any]:
    catalog = load_mcp_catalog()
    store = load_secret_store()
    services: Dict[str, Any] = {}
    for name, server in catalog.get("servers", {}).items():
        server_dir = LOCAL_SERVER_DIRS.get(name, name.removesuffix("_mcp"))
        script_path = local_server_script(name)
        env_keys = server.get("env_keys", [])
        missing = [key for key in env_keys if not secret_status(key, store)["configured"]]
        services[name] = {
            "enabled": bool(server.get("enabled")),
            "kind": "stdio",
            "server_dir": server_dir,
            "script_path": str(script_path.relative_to(APP_ROOT)) if script_path.exists() else str(script_path),
            "implemented": script_path.exists(),
            "configured": not missing,
            "missing_env_keys": missing,
            "required_for": server.get("required_for", []),
        }
    services["artifact_memory"] = {
        "enabled": True,
        "kind": "local_index",
        "implemented": (APP_ROOT / "orchestrator" / "artifact_memory.py").exists(),
        "configured": True,
        "required_for": ["knowledge base", "phase state", "artifacts"],
    }
    return {"services": services}

@router.get("/catalog")
def mcp_catalog() -> Dict[str, Any]:
    return load_mcp_catalog()

@router.get("/validate")
def validate_mcp_and_registry() -> Dict[str, Any]:
    report = validate_runtime_configuration(
        load_agents(),
        load_departments(),
        load_mcp_catalog(),
    )
    return report.as_dict()

@router.get("/secrets")
def list_mcp_secrets() -> Dict[str, Any]:
    store = load_secret_store()
    return {
        "secrets": {key: secret_status(key, store) for key in declared_secret_keys()},
        "storage": {
            "path": "config/secrets.local.json",
            "runtime_env_path": "config/secrets.runtime.env",
            "encrypted": True,
            "gitignored": True,
            "note": "Local development store. Values are never returned by this API.",
        },
    }

@router.put("/secrets/{secret_key}")
def upsert_mcp_secret(secret_key: str, payload: SecretUpdate) -> Dict[str, Any]:
    allowed = set(declared_secret_keys())
    if secret_key not in allowed:
        raise HTTPException(status_code=400, detail="Secret key is not declared by any MCP env_keys entry")
    store = load_secret_store()
    store[secret_key] = payload.value
    save_secret_store(store)
    os.environ[secret_key] = payload.value
    return {
        **secret_status(secret_key, store),
        "restart_required": True,
        "note": "Restart Docker MCP services that read this variable during startup.",
    }

@router.delete("/secrets/{secret_key}")
def delete_mcp_secret(secret_key: str) -> Dict[str, Any]:
    allowed = set(declared_secret_keys())
    if secret_key not in allowed:
        raise HTTPException(status_code=400, detail="Secret key is not declared by any MCP env_keys entry")
    store = load_secret_store()
    store.pop(secret_key, None)
    save_secret_store(store)
    return {
        **secret_status(secret_key, store),
        "restart_required": True,
        "note": "Runtime environment values cannot be removed from this local store.",
    }

@router.put("/catalog/{server_name}")
def upsert_mcp_server(server_name: str, payload: McpServerUpdate) -> Dict[str, Any]:
    catalog = load_mcp_catalog()
    servers = catalog.setdefault("servers", {})
    current = servers.get(server_name, {})
    update = payload.model_dump(exclude_none=True)
    next_server = {**current, **update}
    if update.get("enabled") is True:
        assert_backend_implemented(server_name, next_server)
    servers[server_name] = next_server
    report = validate_mcp_catalog(catalog, load_agents())
    if not report.valid:
        raise HTTPException(status_code=400, detail=report.as_dict())
    save_mcp_catalog(catalog)
    sync_server_required_agents(server_name, servers[server_name])
        
    return {"name": server_name, "server": servers[server_name]}

@router.post("/catalog/{server_name}/toggle")
def toggle_mcp_server(server_name: str) -> Dict[str, Any]:
    catalog = load_mcp_catalog()
    servers = catalog.setdefault("servers", {})
    if server_name not in servers:
        raise HTTPException(status_code=404, detail="MCP server not found")
    next_enabled = not bool(servers[server_name].get("enabled"))
    if next_enabled:
        assert_backend_implemented(server_name, servers[server_name])
    servers[server_name]["enabled"] = next_enabled
    report = validate_mcp_catalog(catalog, load_agents())
    if not report.valid:
        raise HTTPException(status_code=400, detail=report.as_dict())
    save_mcp_catalog(catalog)
    sync_server_required_agents(server_name, servers[server_name])
    return {"name": server_name, "enabled": servers[server_name]["enabled"]}

@router.delete("/catalog/{server_name}")
def delete_mcp_server(server_name: str) -> Dict[str, str]:
    catalog = load_mcp_catalog()
    servers = catalog.setdefault("servers", {})
    if server_name not in servers:
        raise HTTPException(status_code=404, detail="MCP server not found")
    del servers[server_name]
    save_mcp_catalog(catalog)
    
    registry = load_agents()
    agents_map = registry.setdefault("agents", {})
    for agent_data in agents_map.values():
        agent_tools = agent_data.get("tools", [])
        if server_name in agent_tools:
            agent_data["tools"] = [t for t in agent_tools if t != server_name]
    save_agents(registry)
    
    return {"status": "deleted", "name": server_name}

@router.get("/export/{client}")
def mcp_export(client: Literal["codex", "vscode", "cursor", "claude", "opencode"]) -> Dict[str, Any]:
    return export_mcp_config(client, load_mcp_catalog())
