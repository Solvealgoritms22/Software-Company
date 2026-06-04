import os
from pathlib import Path
from typing import Dict, Any
from fastapi import APIRouter, HTTPException

from models import WorkspaceFileContent

router = APIRouter(prefix="/workspace", tags=["workspace"])

ROOT = Path(__file__).resolve().parent.parent
APP_ROOT = ROOT if (ROOT / "config").exists() else ROOT.parent
WORKSPACE_ROOT = Path(os.getenv("WORKSPACE_ROOT", "C:\\ProgramData\\Software-Company\\workspace" if os.name == "nt" else str(APP_ROOT / ".local" / "workspace"))).resolve()
WORKSPACE_ROOT.mkdir(parents=True, exist_ok=True)

@router.get("")
def get_workspace() -> Dict[str, Any]:
    ignore_dirs = {".git", "node_modules", ".venv", ".venv-win", "__pycache__", ".next", "dist", "build", ".vscode", ".idea", ".gemini"}
    
    def build_tree(path: Path) -> Dict[str, Any]:
        result = {
            "name": path.name,
            "type": "dir" if path.is_dir() else "file",
            "path": str(path.relative_to(WORKSPACE_ROOT)).replace("\\", "/") if path != WORKSPACE_ROOT else ""
        }
        if path.is_dir():
            children = []
            try:
                for child in sorted(path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())):
                    if child.name in ignore_dirs:
                        continue
                    children.append(build_tree(child))
            except PermissionError:
                pass
            result["children"] = children
        return result

    return build_tree(WORKSPACE_ROOT)

@router.get("/file")
def get_workspace_file(path: str) -> Dict[str, Any]:
    file_path = WORKSPACE_ROOT / path
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    try:
        content = file_path.read_text(encoding="utf-8")
        return {"path": path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/file")
def save_workspace_file(path: str, payload: WorkspaceFileContent) -> Dict[str, Any]:
    file_path = WORKSPACE_ROOT / path
    try:
        if not file_path.resolve().is_relative_to(WORKSPACE_ROOT.resolve()):
            raise HTTPException(status_code=403, detail="Path traversal detected")
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(payload.content, encoding="utf-8")
        return {"path": path, "status": "saved"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
