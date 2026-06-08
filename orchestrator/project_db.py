import json
from typing import Any, Dict, List, Optional

import psycopg
from psycopg.types.json import Jsonb

from database import db_dsn
from models import ProjectState


def _db_execute(query: str, params: tuple[Any, ...]) -> None:
    try:
        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            conn.execute(query, params)
    except Exception:
        pass


def persist_activity_log(project: ProjectState, log: Dict[str, Any]) -> None:
    _db_execute(
        """
        INSERT INTO activity_logs (id, project_id, agent, phase, message, metadata, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (
            log["id"],
            project.id,
            log["agent"],
            log["phase"],
            log["message"],
            Jsonb(log.get("metadata", {})),
            log["created_at"],
        ),
    )


def persist_artifact_record(project: ProjectState, artifact: Dict[str, Any]) -> None:
    _db_execute(
        """
        INSERT INTO artifacts (id, project_id, type, agent, title, content, uri, created_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
        """,
        (
            artifact["id"],
            project.id,
            artifact["type"],
            artifact["agent"],
            artifact["title"],
            Jsonb(artifact.get("content", {})),
            artifact.get("uri"),
            artifact["created_at"],
        ),
    )


def upsert_phase_run(
    project: ProjectState,
    phase_id: str,
    status: str,
    error: Optional[str] = None,
    output: Optional[Dict[str, Any]] = None,
) -> None:
    phase = project.phases.get(phase_id, {})
    content = output or {}
    usage = content.get("usage") or {}
    cost = float(content.get("estimated_cost_usd") or 0)
    _db_execute(
        """
        INSERT INTO phase_runs (project_id, phase, agent, status, started_at, completed_at, error, output, usage, cost_usd)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (project_id, phase) DO UPDATE SET
            agent = EXCLUDED.agent,
            status = EXCLUDED.status,
            started_at = COALESCE(EXCLUDED.started_at, phase_runs.started_at),
            completed_at = EXCLUDED.completed_at,
            error = EXCLUDED.error,
            output = EXCLUDED.output,
            usage = EXCLUDED.usage,
            cost_usd = EXCLUDED.cost_usd
        """,
        (
            project.id,
            phase_id,
            phase.get("agent", "system"),
            status,
            phase.get("started_at"),
            phase.get("completed_at"),
            error,
            Jsonb(content),
            Jsonb(usage),
            cost,
        ),
    )


def load_phase_checkpoint(project_id: str, phase_id: str) -> Optional[Dict[str, Any]]:
    try:
        with psycopg.connect(db_dsn()) as conn:
            row = conn.execute(
                """
                SELECT output
                FROM phase_runs
                WHERE project_id = %s
                  AND phase = %s
                  AND status = 'completed'
                  AND output IS NOT NULL
                LIMIT 1
                """,
                (project_id, phase_id),
            ).fetchone()
    except Exception:
        return None
    if not row or not row[0]:
        return None
    output = row[0]
    if isinstance(output, str):
        try:
            output = json.loads(output)
        except Exception:
            return None
    return output if isinstance(output, dict) and output else None


def delete_phase_checkpoints(project_id: str, phase_ids: List[str]) -> None:
    for phase_id in phase_ids:
        _db_execute(
            "DELETE FROM phase_runs WHERE project_id = %s AND phase = %s",
            (project_id, phase_id),
        )
