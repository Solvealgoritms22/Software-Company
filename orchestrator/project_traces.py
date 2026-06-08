import json
from typing import Any, Dict, List

import psycopg
from psycopg.types.json import Jsonb

from database import db_dsn
from models import ProjectState
from project_db import _db_execute
from token_budget import redact_secrets


def persist_trace(project: ProjectState, phase_id: str, agent_id: str, event_type: str, content: Dict[str, Any]) -> None:
    usage = content.get("usage") or {}
    metadata = {
        "summary": content.get("summary"),
        "risks": content.get("risks", []),
        "citations": content.get("citations", []),
        "prompt_budget": content.get("prompt_budget", {}),
        **(content.get("metadata") or {}),
    }
    try:
        safe_metadata = json.loads(redact_secrets(metadata))
    except Exception:
        safe_metadata = {"redacted": redact_secrets(metadata)}
    _db_execute(
        """
        INSERT INTO agent_traces (
            project_id, phase, agent, event_type, model, provider,
            prompt_tokens, completion_tokens, cached_tokens, estimated_cost_usd, metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            project.id,
            phase_id,
            agent_id,
            event_type,
            content.get("model"),
            content.get("provider"),
            int(usage.get("prompt_tokens") or 0),
            int(usage.get("completion_tokens") or 0),
            int(usage.get("cached_tokens") or 0),
            float(content.get("estimated_cost_usd") or 0),
            Jsonb(safe_metadata),
        ),
    )


def list_project_traces(project_id: str, limit: int = 100) -> List[Dict[str, Any]]:
    try:
        with psycopg.connect(db_dsn()) as conn:
            rows = conn.execute(
                """
                SELECT id, phase, agent, event_type, model, provider,
                       prompt_tokens, completion_tokens, cached_tokens,
                       estimated_cost_usd, metadata, created_at
                FROM agent_traces
                WHERE project_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (project_id, limit),
            ).fetchall()
    except Exception:
        return []
    return [
        {
            "id": str(row[0]),
            "phase": row[1],
            "agent": row[2],
            "event_type": row[3],
            "model": row[4],
            "provider": row[5],
            "prompt_tokens": int(row[6] or 0),
            "completion_tokens": int(row[7] or 0),
            "cached_tokens": int(row[8] or 0),
            "estimated_cost_usd": float(row[9] or 0),
            "metadata": row[10] or {},
            "created_at": row[11].isoformat() if hasattr(row[11], "isoformat") else str(row[11]),
        }
        for row in rows
    ]
