from __future__ import annotations

import subprocess
import tempfile
import threading
import os
from pathlib import Path
from urllib.parse import urlparse

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from update_checker import check_for_update

router = APIRouter(prefix="/app", tags=["app"])

APP_VERSION = "1.0.0"

_update_lock = threading.RLock()
_update_status: dict = {
    "active": False,
    "progress": 0,
    "state": "idle",
    "message": "",
    "path": "",
}


class UpdateInstallRequest(BaseModel):
    url: str


@router.get("/updates/check")
def updates_check() -> dict:
    update = check_for_update()
    if not update:
        return {"success": True, "update": None}
    
    remote_version = str(update.get("version", "")).strip()
    if not _is_newer_version(remote_version, APP_VERSION):
        return {"success": True, "update": None}
        
    update["current_version"] = APP_VERSION
    return {"success": True, "update": update}


def _version_tuple(value: str) -> tuple[int, ...]:
    parts = []
    for part in str(value or "").replace("v", "").split("."):
        digits = "".join(ch for ch in part if ch.isdigit())
        if digits:
            parts.append(int(digits))
    return tuple(parts[:4]) if parts else (0,)


def _is_newer_version(remote_version: str, current_version: str) -> bool:
    remote = _version_tuple(remote_version)
    current = _version_tuple(current_version)
    max_len = max(len(remote), len(current))
    remote += (0,) * (max_len - len(remote))
    current += (0,) * (max_len - len(current))
    return remote > current


@router.post("/updates/download-and-install")
def updates_download_and_install(body: UpdateInstallRequest) -> dict:
    url = str(body.url or "").strip()
    if not url.lower().startswith("https://"):
        raise HTTPException(status_code=400, detail="La actualización debe descargarse desde una URL HTTPS.")

    with _update_lock:
        if _update_status.get("active"):
            return {"success": True, "message": "La descarga ya está en progreso."}
        _update_status.update({
            "active": True,
            "progress": 0,
            "state": "downloading",
            "message": "Descargando actualización...",
            "path": "",
        })

    thread = threading.Thread(target=_download_and_install_worker, args=(url,), daemon=True)
    thread.start()
    return {"success": True, "message": "Descarga iniciada."}


@router.get("/updates/status")
def updates_status() -> dict:
    with _update_lock:
        return {"success": True, "update": dict(_update_status)}


def _download_and_install_worker(url: str) -> None:
    try:
        parsed = urlparse(url)
        filename = Path(parsed.path).name or "DevFoundry-Setup.exe"
        if not filename.lower().endswith(".exe"):
            filename = f"{filename}.exe"

        updates_dir = Path(tempfile.gettempdir()) / "DevFoundry" / "updates"
        updates_dir.mkdir(parents=True, exist_ok=True)
        output_path = updates_dir / filename
        temp_path = output_path.with_suffix(f"{output_path.suffix}.download")

        with requests.get(url, stream=True, timeout=30) as response:
            response.raise_for_status()
            total_size = int(response.headers.get("content-length", 0))
            downloaded = 0
            last_percent = -1
            with open(temp_path, "wb") as file:
                for chunk in response.iter_content(chunk_size=1024 * 128):
                    if not chunk:
                        continue
                    file.write(chunk)
                    downloaded += len(chunk)
                    if total_size > 0:
                        percent = int((downloaded / total_size) * 100)
                        if percent != last_percent:
                            with _update_lock:
                                _update_status.update({"progress": percent, "message": f"Descargando actualización... {percent}%"})
                            last_percent = percent

        temp_path.replace(output_path)
        with _update_lock:
            _update_status.update({
                "active": False,
                "progress": 100,
                "state": "launching",
                "message": "Actualización descargada. Abriendo instalador...",
                "path": str(output_path),
            })
        
        # Launch the downloaded installer installer
        subprocess.Popen([str(output_path)], close_fds=True)
    except Exception as exc:
        with _update_lock:
            _update_status.update({
                "active": False,
                "state": "error",
                "message": str(exc)[:180] or "No se pudo descargar o ejecutar la actualización.",
            })
