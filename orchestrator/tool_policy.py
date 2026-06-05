import hashlib
import json
import os
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from config_manager import load_settings, now_iso
from token_budget import redact_secrets

ROOT = Path(__file__).resolve().parent
APP_ROOT = ROOT if (ROOT / "config").exists() else ROOT.parent
APPROVALS_PATH = APP_ROOT / "config" / "tool_approvals.json"

APPROVAL_REQUIRED_TOOLS = {
    "deploy_vercel": "deployment",
    "deploy_railway": "deployment",
    "github_create_repo": "external_write",
    "github_create_branch": "external_write",
    "github_commit_files": "external_write",
    "github_create_pull_request": "external_write",
    "jira_create_issue": "external_write",
    "jira_add_comment": "external_write",
    "jira_transition_issue": "external_write",
    "confluence_create_page": "external_write",
    "google_drive_create_text_file": "external_write",
    "google_drive_create_permission": "external_permission",
}

COMMAND_APPROVAL_PATTERNS = (
    "rm ",
    "rmdir",
    "del ",
    "remove-item",
    "git push",
    "npm publish",
    "pnpm publish",
    "yarn publish",
    "docker ",
    "vercel ",
    "railway ",
)


def _load_store() -> Dict[str, Any]:
    if not APPROVALS_PATH.exists():
        return {"approvals": []}
    try:
        data = json.loads(APPROVALS_PATH.read_text(encoding="utf-8"))
        if isinstance(data, dict) and isinstance(data.get("approvals"), list):
            return data
    except Exception:
        pass
    return {"approvals": []}


def _save_store(data: Dict[str, Any]) -> None:
    APPROVALS_PATH.parent.mkdir(parents=True, exist_ok=True)
    APPROVALS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def _safe_json(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, ensure_ascii=True, default=str)
    except Exception:
        return json.dumps(str(value), ensure_ascii=True)


def tool_fingerprint(project_id: Optional[str], phase_id: Optional[str], agent_name: Optional[str], tool_name: str, arguments: Dict[str, Any]) -> str:
    raw = _safe_json({
        "project_id": project_id,
        "phase_id": phase_id,
        "agent_name": agent_name,
        "tool_name": tool_name,
        "arguments": arguments,
    })
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def classify_tool(tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
    if tool_name in APPROVAL_REQUIRED_TOOLS:
        return {
            "risk": "high",
            "category": APPROVAL_REQUIRED_TOOLS[tool_name],
            "requires_approval": True,
            "reason": f"{tool_name} performs an external state-changing action.",
        }
    if tool_name == "execute_command":
        command = str(arguments.get("command") or "").strip().lower()
        if any(pattern in command for pattern in COMMAND_APPROVAL_PATTERNS):
            return {
                "risk": "high",
                "category": "command",
                "requires_approval": True,
                "reason": "Command can change external state, publish artifacts, or delete files.",
            }
        return {"risk": "medium", "category": "command", "requires_approval": False, "reason": "Workspace command."}
    if tool_name in {"write_file", "download_resource", "generate_image", "edit_image"}:
        require_local_write = os.getenv("TOOL_POLICY_REQUIRE_LOCAL_WRITE_APPROVAL", "false").lower() == "true"
        return {
            "risk": "medium",
            "category": "local_write",
            "requires_approval": require_local_write,
            "reason": "Local workspace write.",
        }
    if tool_name.startswith(("github_", "jira_", "confluence_", "google_drive_", "deploy_")):
        return {
            "risk": "medium",
            "category": "external_read_or_safe",
            "requires_approval": False,
            "reason": "External tool call allowed by default policy.",
        }
    return {"risk": "low", "category": "safe", "requires_approval": False, "reason": "Read-only or low-risk tool."}


def list_tool_approvals(project_id: Optional[str] = None) -> List[Dict[str, Any]]:
    approvals = _load_store().get("approvals", [])
    if project_id:
        approvals = [item for item in approvals if item.get("project_id") == project_id]
    return sorted(approvals, key=lambda item: item.get("created_at", ""), reverse=True)


def set_tool_approval_status(approval_id: str, status: str, decided_by: str = "founder", note: str = "") -> Optional[Dict[str, Any]]:
    data = _load_store()
    for approval in data["approvals"]:
        if approval.get("id") == approval_id:
            approval["status"] = status
            approval["decided_by"] = decided_by
            approval["decision_note"] = note
            approval["decided_at"] = now_iso()
            _save_store(data)
            return approval
    return None


def evaluate_tool_policy(
    tool_name: str,
    arguments: Dict[str, Any],
    agent_name: Optional[str] = None,
    project_id: Optional[str] = None,
    phase_id: Optional[str] = None,
) -> Dict[str, Any]:
    policy = classify_tool(tool_name, arguments)
    fingerprint = tool_fingerprint(project_id, phase_id, agent_name, tool_name, arguments)
    if load_settings().get("tool_policy_mode") == "full_access":
        return {
            "allowed": True,
            "approval_bypassed": bool(policy["requires_approval"]),
            "fingerprint": fingerprint,
            **policy,
        }
    if not policy["requires_approval"]:
        return {"allowed": True, "fingerprint": fingerprint, **policy}

    data = _load_store()
    for approval in data["approvals"]:
        if approval.get("fingerprint") == fingerprint:
            if approval.get("status") == "approved":
                return {"allowed": True, "approval": approval, "fingerprint": fingerprint, **policy}
            return {"allowed": False, "approval": approval, "fingerprint": fingerprint, **policy}

    try:
        safe_arguments = json.loads(redact_secrets(arguments))
    except Exception:
        safe_arguments = {"redacted": redact_secrets(arguments)}
    approval = {
        "id": str(uuid.uuid4()),
        "project_id": project_id,
        "phase_id": phase_id,
        "agent_name": agent_name,
        "tool_name": tool_name,
        "arguments": safe_arguments,
        "fingerprint": fingerprint,
        "risk": policy["risk"],
        "category": policy["category"],
        "reason": policy["reason"],
        "status": "pending",
        "created_at": now_iso(),
    }
    data["approvals"].append(approval)
    _save_store(data)
    return {"allowed": False, "approval": approval, "fingerprint": fingerprint, **policy}
