import hashlib
import json
import os
from typing import Any, Dict, Optional

from token_budget import redact_secrets
from tool_policy import classify_tool, tool_fingerprint


def _enabled() -> bool:
    return os.getenv("TOOL_IDEMPOTENCY_ENABLED", "true").lower() != "false"


def _stale_seconds() -> int:
    try:
        return max(60, int(os.getenv("TOOL_IDEMPOTENCY_STALE_SECONDS", "900")))
    except Exception:
        return 900


def _result_hash(result: str) -> str:
    return hashlib.sha256(result.encode("utf-8", errors="ignore")).hexdigest()


def _safe_arguments(arguments: Dict[str, Any]) -> Dict[str, Any]:
    try:
        return json.loads(redact_secrets(arguments))
    except Exception:
        return {"redacted": redact_secrets(str(arguments))}


def should_track_tool(tool_name: str, arguments: Dict[str, Any]) -> bool:
    policy = classify_tool(tool_name, arguments)
    if policy.get("category") in {"deployment", "external_write", "external_permission"}:
        return True
    if policy.get("category") == "command" and policy.get("risk") == "high":
        return True
    if os.getenv("TOOL_IDEMPOTENCY_LOCAL_WRITES", "false").lower() == "true":
        return policy.get("category") == "local_write"
    return False


def reserve_tool_call(
    tool_name: str,
    arguments: Dict[str, Any],
    agent_name: Optional[str] = None,
    project_id: Optional[str] = None,
    phase_id: Optional[str] = None,
) -> Dict[str, Any]:
    if not _enabled() or not should_track_tool(tool_name, arguments):
        return {"enabled": False}

    idempotency_key = tool_fingerprint(project_id, phase_id, agent_name, tool_name, arguments)
    try:
        import psycopg
        from psycopg.types.json import Jsonb
        from database import db_dsn

        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            row = conn.execute(
                """
                SELECT id, status, result, hit_count,
                       EXTRACT(EPOCH FROM (NOW() - updated_at))::integer AS age_seconds
                FROM tool_idempotency_records
                WHERE idempotency_key = %s
                LIMIT 1
                """,
                (idempotency_key,),
            ).fetchone()
            if row:
                record_id, status, result, hit_count, age_seconds = row
                if status == "completed" and result is not None:
                    conn.execute(
                        """
                        UPDATE tool_idempotency_records
                        SET hit_count = hit_count + 1,
                            last_hit_at = NOW(),
                            updated_at = NOW()
                        WHERE id = %s
                        """,
                        (record_id,),
                    )
                    return {
                        "enabled": True,
                        "hit": True,
                        "id": str(record_id),
                        "idempotency_key": idempotency_key,
                        "result": result,
                        "hit_count": int(hit_count or 0) + 1,
                    }
                if status == "running" and int(age_seconds or 0) < _stale_seconds():
                    return {
                        "enabled": True,
                        "blocked": True,
                        "id": str(record_id),
                        "idempotency_key": idempotency_key,
                        "reason": "Duplicate tool call is already running.",
                    }
                conn.execute(
                    """
                    UPDATE tool_idempotency_records
                    SET status = 'running',
                        error = NULL,
                        result = NULL,
                        attempt_count = attempt_count + 1,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    (record_id,),
                )
                return {"enabled": True, "reserved": True, "id": str(record_id), "idempotency_key": idempotency_key}

            inserted = conn.execute(
                """
                INSERT INTO tool_idempotency_records (
                    project_id, phase, agent, tool_name, idempotency_key, arguments,
                    status, attempt_count, created_at, updated_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'running', 1, NOW(), NOW())
                RETURNING id
                """,
                (
                    project_id,
                    phase_id,
                    agent_name,
                    tool_name,
                    idempotency_key,
                    Jsonb(_safe_arguments(arguments)),
                ),
            ).fetchone()
            return {
                "enabled": True,
                "reserved": True,
                "id": str(inserted[0]),
                "idempotency_key": idempotency_key,
            }
    except Exception:
        return {"enabled": False, "error": "idempotency_store_unavailable"}


def complete_tool_call(record_id: Optional[str], result: str) -> None:
    if not record_id:
        return
    try:
        import psycopg
        from database import db_dsn

        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            conn.execute(
                """
                UPDATE tool_idempotency_records
                SET status = 'completed',
                    result = %s,
                    result_hash = %s,
                    error = NULL,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (result, _result_hash(result), record_id),
            )
    except Exception:
        pass


def fail_tool_call(record_id: Optional[str], error: str, result: Optional[str] = None) -> None:
    if not record_id:
        return
    try:
        import psycopg
        from database import db_dsn

        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            conn.execute(
                """
                UPDATE tool_idempotency_records
                SET status = 'failed',
                    error = %s,
                    result = %s,
                    result_hash = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (error, result, _result_hash(result or error), record_id),
            )
    except Exception:
        pass
