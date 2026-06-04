import json
import os
from typing import Any, Dict, Optional

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("google_drive", dependencies=["google-api-python-client", "google-auth"])

SCOPES = ["https://www.googleapis.com/auth/drive.file"]

def env(name: str, default: str = "") -> str:
    return os.getenv(name, default)

def load_credentials():
    raw_json = env("GOOGLE_DRIVE_CREDENTIALS_JSON") or env("GOOGLE_DRIVE_CREDENTIALS")
    credentials_path = env("GOOGLE_APPLICATION_CREDENTIALS")
    if raw_json:
        try:
            info = json.loads(raw_json)
        except json.JSONDecodeError as exc:
            raise ValueError("GOOGLE_DRIVE_CREDENTIALS_JSON is not valid JSON") from exc
        return service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    if credentials_path:
        return service_account.Credentials.from_service_account_file(credentials_path, scopes=SCOPES)
    raise ValueError("Google Drive credentials are not configured")

def drive_service():
    return build("drive", "v3", credentials=load_credentials(), cache_discovery=False)

@mcp.tool()
def google_drive_create_text_file(name: str, content: str = "", mime_type: str = "text/markdown", folder_id: str = "") -> str:
    """Guarda un archivo de texto o markdown en Google Drive."""
    try:
        service = drive_service()
        fid = folder_id or env("GOOGLE_DRIVE_FOLDER_ID")
        metadata: Dict[str, Any] = {"name": name}
        if fid:
            metadata["parents"] = [fid]
        media = MediaInMemoryUpload(content.encode("utf-8"), mimetype=mime_type, resumable=False)
        file = (
            service.files()
            .create(body=metadata, media_body=media, fields="id,name,mimeType,webViewLink,webContentLink")
            .execute()
        )
        return json.dumps(file)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
def google_drive_create_permission(file_id: str, role: str = "reader", type: str = "anyone", email_address: str = "") -> str:
    """Concede permisos de acceso a un archivo en Google Drive."""
    try:
        service = drive_service()
        permission: Dict[str, Any] = {"role": role, "type": type}
        if email_address:
            permission["emailAddress"] = email_address
        created = service.permissions().create(fileId=file_id, body=permission, fields="id").execute()
        return json.dumps(created)
    except Exception as exc:
        return json.dumps({"error": str(exc)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

