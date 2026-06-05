import asyncio
import uuid
import json
import psycopg
from psycopg.types.json import Jsonb
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import WebSocket

from models import ProjectState
from database import db_dsn
from artifact_memory import index_artifact, reindex_project_memory, retrieve_project_memory
from llm_client import generate_phase_artifact
from config_manager import load_agents, load_mcp_catalog
from semantic_cache import (
    reusable_semantic_phase_output,
    retrieve_semantic_phase_cache,
    store_semantic_phase_cache,
)
from token_budget import project_cost_limit, redact_secrets

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

PROJECTS: Dict[str, ProjectState] = {}
SUBSCRIBERS: Dict[str, List[WebSocket]] = {}
RUN_LOCKS: Dict[str, asyncio.Lock] = {}
PROJECT_TASKS: Dict[str, asyncio.Task] = {}

def cancel_project_run(project_id: str) -> None:
    task = PROJECT_TASKS.get(project_id)
    if task and not task.done():
        task.cancel()

PHASES = [
    {"id": "ceo", "agent": "ceo", "depends_on": []},
    {"id": "analysis", "agent": "business_analyst", "depends_on": ["ceo"]},
    {"id": "legal_contract", "agent": "legal", "depends_on": ["analysis"]},
    {"id": "founder_approval", "agent": "ceo", "depends_on": ["legal_contract"]},
    {"id": "architecture", "agent": "software_architect", "depends_on": ["founder_approval"]},
    {"id": "senior_backend", "agent": "senior_backend", "depends_on": ["architecture"]},
    {"id": "backend_development", "agent": "backend_developer", "depends_on": ["senior_backend"]},
    {"id": "frontend_architecture", "agent": "frontend_architect", "depends_on": ["architecture"]},
    {"id": "frontend_development", "agent": "frontend_developer", "depends_on": ["frontend_architecture"]},
    {"id": "database", "agent": "dba", "depends_on": ["architecture"]},
    {"id": "qa", "agent": "qa", "depends_on": ["backend_development", "frontend_development", "database"]},
    {"id": "security", "agent": "security", "depends_on": ["qa"]},
    {"id": "devops", "agent": "devops", "depends_on": ["security"]},
    {"id": "documentation", "agent": "technical_writer", "depends_on": ["devops"]},
    {"id": "done", "agent": "ceo", "depends_on": ["documentation"]},
]

def build_initial_phases() -> Dict[str, Dict[str, Any]]:
    return {
        phase["id"]: {
            "id": phase["id"],
            "agent": phase["agent"],
            "depends_on": phase["depends_on"],
            "status": "pending",
            "started_at": None,
            "completed_at": None,
            "error": None,
        }
        for phase in PHASES
    }


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


def persist_retrieval_eval(project: ProjectState, phase_id: str, agent_id: str, output: Dict[str, Any]) -> None:
    phase = project.phases.get(phase_id, {})
    started_at = phase.get("started_at")
    try:
        with psycopg.connect(db_dsn()) as conn:
            rows = conn.execute(
                """
                SELECT event_type, metadata
                FROM agent_traces
                WHERE project_id = %s
                  AND phase = %s
                  AND agent = %s
                  AND event_type IN ('memory_retrieved', 'semantic_cache_retrieved')
                  AND (%s::timestamptz IS NULL OR created_at >= %s::timestamptz)
                ORDER BY created_at ASC
                """,
                (project.id, phase_id, agent_id, started_at, started_at),
            ).fetchall()
    except Exception:
        rows = []

    available: List[str] = []
    context_tokens = 0
    candidate_tokens = 0
    source_events = 0
    for event_type, metadata in rows:
        data = metadata or {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                data = {}
        citations = [str(item) for item in (data.get("citations") or []) if item]
        available.extend(citations)
        context_tokens += int(data.get("token_estimate") or 0)
        candidate_tokens += int(data.get("candidate_tokens") or data.get("token_estimate") or 0)
        source_events += 1

    available_unique = sorted(set(available))
    used_unique = sorted({str(item) for item in (output.get("citations") or []) if item})
    matched = sorted(set(used_unique).intersection(available_unique))
    missing = sorted(set(used_unique).difference(available_unique))

    if not available_unique:
        status = "no_context"
        score = 1.0 if not used_unique else 0.25
    elif matched:
        status = "passed"
        score = min(1.0, len(matched) / max(1, min(len(available_unique), 3)))
    elif used_unique:
        status = "cited_unknown"
        score = 0.25
    else:
        status = "unused_context"
        score = 0.0

    _db_execute(
        """
        INSERT INTO retrieval_evals (
            project_id, phase, agent, available_citations, used_citations,
            matched_citations, missing_citations, context_tokens_sent,
            candidate_tokens_seen, score, status, metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            project.id,
            phase_id,
            agent_id,
            Jsonb(available_unique),
            Jsonb(used_unique),
            Jsonb(matched),
            Jsonb(missing),
            context_tokens,
            candidate_tokens,
            round(score, 4),
            status,
            Jsonb({"source_events": source_events}),
        ),
    )


def persist_phase_contract_eval(project: ProjectState, phase_id: str, agent_id: str, output: Dict[str, Any]) -> None:
    validation = output.get("contract_validation")
    if not isinstance(validation, dict):
        return
    _db_execute(
        """
        INSERT INTO phase_contract_evals (
            project_id, phase, agent, schema_name, valid, strict, autofixed,
            expected_deliverables, missing_deliverables, extra_deliverables,
            issues, corrections
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            project.id,
            phase_id,
            agent_id,
            str(validation.get("schema_name") or "phase_output_contract"),
            bool(validation.get("valid")),
            bool(validation.get("strict", True)),
            bool(validation.get("autofixed")),
            Jsonb(validation.get("expected_deliverables") or []),
            Jsonb(validation.get("missing_deliverables") or []),
            Jsonb(validation.get("extra_deliverables") or []),
            Jsonb(validation.get("issues") or []),
            Jsonb(validation.get("corrections") or []),
        ),
    )
    persist_trace(
        project,
        phase_id,
        agent_id,
        "phase_contract_validated",
        {
            "metadata": {
                "valid": bool(validation.get("valid")),
                "autofixed": bool(validation.get("autofixed")),
                "issues": validation.get("issues") or [],
                "corrections": validation.get("corrections") or [],
            }
        },
    )


def _tool_fingerprint(metadata: Dict[str, Any]) -> str:
    return json.dumps(
        {
            "tool_name": metadata.get("tool_name"),
            "arguments": metadata.get("arguments") or {},
        },
        ensure_ascii=True,
        sort_keys=True,
        default=str,
    )


def persist_phase_quality_eval(project: ProjectState, phase_id: str, agent_id: str, output: Dict[str, Any]) -> None:
    phase = project.phases.get(phase_id, {})
    started_at = phase.get("started_at")
    agent_cfg = load_agents().get("agents", {}).get(agent_id, {})
    expected_deliverables = [str(item) for item in agent_cfg.get("deliverables", [])]
    deliverables = output.get("deliverables") if isinstance(output.get("deliverables"), dict) else {}
    risks = output.get("risks") if isinstance(output.get("risks"), list) else []
    next_inputs = output.get("next_required_inputs") if isinstance(output.get("next_required_inputs"), list) else []
    citations = output.get("citations") if isinstance(output.get("citations"), list) else []
    summary = output.get("summary") if isinstance(output.get("summary"), str) else ""
    contract_validation = output.get("contract_validation") if isinstance(output.get("contract_validation"), dict) else {}

    expected_present = [key for key in expected_deliverables if key in deliverables and str(deliverables.get(key) or "").strip()]
    missing_deliverables = [key for key in expected_deliverables if key not in expected_present]
    checks = {
        "has_summary": bool(summary.strip()),
        "has_deliverables_object": isinstance(output.get("deliverables"), dict),
        "expected_deliverables": expected_deliverables,
        "expected_deliverables_present": expected_present,
        "missing_deliverables": missing_deliverables,
        "has_risks_array": isinstance(output.get("risks"), list),
        "has_next_inputs_array": isinstance(output.get("next_required_inputs"), list),
        "has_citations_array": isinstance(output.get("citations"), list),
        "risks_count": len(risks),
        "next_inputs_count": len(next_inputs),
        "citations_count": len(citations),
        "contract_valid": bool(contract_validation.get("valid", True)),
        "contract_autofixed": bool(contract_validation.get("autofixed", False)),
        "contract_issues": contract_validation.get("issues") or [],
    }
    issues: List[str] = []
    if not checks["has_summary"]:
        issues.append("missing_summary")
    if not checks["has_deliverables_object"]:
        issues.append("invalid_deliverables_object")
    if missing_deliverables:
        issues.append("missing_expected_deliverables")
    if not checks["has_risks_array"]:
        issues.append("invalid_risks_array")
    if not checks["has_next_inputs_array"]:
        issues.append("invalid_next_inputs_array")
    if contract_validation and not checks["contract_valid"]:
        issues.append("invalid_phase_contract")
    if checks["contract_autofixed"]:
        issues.append("phase_contract_autofixed")

    try:
        with psycopg.connect(db_dsn()) as conn:
            rows = conn.execute(
                """
                SELECT metadata
                FROM agent_traces
                WHERE project_id = %s
                  AND phase = %s
                  AND agent = %s
                  AND event_type = 'tool_call'
                  AND (%s::timestamptz IS NULL OR created_at >= %s::timestamptz)
                ORDER BY created_at ASC
                """,
                (project.id, phase_id, agent_id, started_at, started_at),
            ).fetchall()
    except Exception:
        rows = []

    risky_prefixes = ("github_", "jira_", "confluence_", "google_drive_", "deploy_", "security_", "playwright_")
    risky_tools = {"execute_command", "write_file", "download_resource", "generate_image", "edit_image"}
    tool_calls_count = 0
    risky_tool_calls_count = 0
    failed_tool_calls_count = 0
    seen_tools: Dict[str, int] = {}
    duplicate_tool_calls_count = 0
    for (metadata,) in rows:
        data = metadata or {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                data = {}
        tool_name = str(data.get("tool_name") or "")
        status = str(data.get("status") or "")
        if not tool_name:
            continue
        tool_calls_count += 1
        if tool_name in risky_tools or tool_name.startswith(risky_prefixes):
            risky_tool_calls_count += 1
        if status in {"failed", "approval_required", "intervention_requested"}:
            failed_tool_calls_count += 1
        fingerprint = _tool_fingerprint(data)
        seen_tools[fingerprint] = seen_tools.get(fingerprint, 0) + 1

    duplicate_tool_calls_count = sum(count - 1 for count in seen_tools.values() if count > 1)
    checks.update(
        {
            "tool_calls_count": tool_calls_count,
            "risky_tool_calls_count": risky_tool_calls_count,
            "failed_tool_calls_count": failed_tool_calls_count,
            "duplicate_tool_calls_count": duplicate_tool_calls_count,
        }
    )
    if duplicate_tool_calls_count:
        issues.append("duplicate_tool_calls")
    if failed_tool_calls_count:
        issues.append("failed_tool_calls")

    expected_ratio = 1.0
    if expected_deliverables:
        expected_ratio = len(expected_present) / max(len(expected_deliverables), 1)
    structure_checks = [
        checks["has_summary"],
        checks["has_deliverables_object"],
        checks["has_risks_array"],
        checks["has_next_inputs_array"],
        checks["has_citations_array"],
    ]
    structure_ratio = sum(1 for item in structure_checks if item) / len(structure_checks)
    side_effect_penalty = min(0.25, (failed_tool_calls_count * 0.08) + (duplicate_tool_calls_count * 0.05))
    contract_penalty = 0.10 if checks["contract_autofixed"] else 0.0
    if contract_validation and not checks["contract_valid"]:
        contract_penalty = 0.20
    score = max(0.0, min(1.0, (0.45 * structure_ratio) + (0.45 * expected_ratio) + 0.10 - side_effect_penalty - contract_penalty))
    if score >= 0.85 and not issues:
        status = "passed"
    elif score >= 0.6:
        status = "warning"
    else:
        status = "failed"

    _db_execute(
        """
        INSERT INTO phase_quality_evals (
            project_id, phase, agent, score, status, checks, issues,
            tool_calls_count, risky_tool_calls_count, duplicate_tool_calls_count
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            project.id,
            phase_id,
            agent_id,
            round(score, 4),
            status,
            Jsonb(checks),
            Jsonb(issues),
            tool_calls_count,
            risky_tool_calls_count,
            duplicate_tool_calls_count,
        ),
    )
    persist_trace(
        project,
        phase_id,
        agent_id,
        "quality_eval_completed",
        {
            "metadata": {
                "score": round(score, 4),
                "status": status,
                "issues": issues,
                "checks": checks,
            }
        },
    )


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


def _usage_row(row: Any, label_key: str) -> Dict[str, Any]:
    prompt_tokens = int(row[2] or 0)
    completion_tokens = int(row[3] or 0)
    cached_tokens = int(row[4] or 0)
    return {
        label_key: row[0],
        "events": int(row[1] or 0),
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cached_tokens": cached_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
        "estimated_cost_usd": round(float(row[5] or 0), 6),
    }


def empty_project_usage_summary(project_id: str) -> Dict[str, Any]:
    max_cost = project_cost_limit()
    return {
        "project_id": project_id,
        "totals": {
            "events": 0,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "cached_tokens": 0,
            "total_tokens": 0,
            "estimated_cost_usd": 0.0,
        },
        "budget": {
            "max_project_cost_usd": max_cost,
            "remaining_usd": max_cost if max_cost else None,
            "usage_ratio": 0.0,
            "is_exceeded": False,
        },
        "by_phase": [],
        "by_agent": [],
        "by_model": [],
        "context_economy": {
            "memory_events": 0,
            "memory_chunks": 0,
            "semantic_cache_events": 0,
            "semantic_cache_items": 0,
            "context_tokens_sent": 0,
            "candidate_tokens_seen": 0,
            "tokens_avoided_estimate": 0,
            "citations_available": 0,
            "citations_used": 0,
            "prompt_tokens_observed": 0,
            "retrieval_eval_count": 0,
            "retrieval_eval_score": 0.0,
            "retrieval_eval_statuses": {},
            "failed_retrieval_phases": [],
            "quality_eval_count": 0,
            "quality_eval_score": 0.0,
            "quality_eval_statuses": {},
            "quality_failed_phases": [],
            "side_effect_warnings": 0,
            "contract_eval_count": 0,
            "contract_valid_count": 0,
            "contract_autofix_count": 0,
            "contract_issue_count": 0,
            "idempotency_records": 0,
            "idempotency_hits": 0,
            "idempotency_replays_prevented": 0,
            "poor_retrieval_phases": [],
        },
    }


def project_context_economy(project_id: str) -> Dict[str, Any]:
    economy = {
        "memory_events": 0,
        "memory_chunks": 0,
        "semantic_cache_events": 0,
        "semantic_cache_items": 0,
        "context_tokens_sent": 0,
        "candidate_tokens_seen": 0,
        "tokens_avoided_estimate": 0,
        "citations_available": 0,
        "citations_used": 0,
        "prompt_tokens_observed": 0,
        "retrieval_eval_count": 0,
        "retrieval_eval_score": 0.0,
        "retrieval_eval_statuses": {},
        "failed_retrieval_phases": [],
        "quality_eval_count": 0,
        "quality_eval_score": 0.0,
        "quality_eval_statuses": {},
        "quality_failed_phases": [],
        "side_effect_warnings": 0,
        "contract_eval_count": 0,
        "contract_valid_count": 0,
        "contract_autofix_count": 0,
        "contract_issue_count": 0,
        "idempotency_records": 0,
        "idempotency_hits": 0,
        "idempotency_replays_prevented": 0,
        "poor_retrieval_phases": [],
    }
    phase_citation_supply: Dict[str, int] = {}
    phase_citation_use: Dict[str, int] = {}
    try:
        with psycopg.connect(db_dsn()) as conn:
            rows = conn.execute(
                """
                SELECT phase, event_type, metadata
                FROM agent_traces
                WHERE project_id = %s
                  AND event_type IN ('memory_retrieved', 'semantic_cache_retrieved', 'phase_completed', 'llm_call')
                ORDER BY created_at ASC
                """,
                (project_id,),
            ).fetchall()
    except Exception:
        return economy

    for phase, event_type, metadata in rows:
        data = metadata or {}
        if isinstance(data, str):
            try:
                data = json.loads(data)
            except Exception:
                data = {}
        if event_type == "memory_retrieved":
            chunks = int(data.get("chunks") or 0)
            citations = data.get("citations") or []
            token_estimate = int(data.get("token_estimate") or 0)
            candidate_tokens = int(data.get("candidate_tokens") or token_estimate)
            economy["memory_events"] += 1
            economy["memory_chunks"] += chunks
            economy["context_tokens_sent"] += token_estimate
            economy["candidate_tokens_seen"] += candidate_tokens
            economy["citations_available"] += len(citations)
            phase_citation_supply[phase] = phase_citation_supply.get(phase, 0) + len(citations)
        elif event_type == "semantic_cache_retrieved":
            items = int(data.get("items") or 0)
            citations = data.get("citations") or []
            token_estimate = int(data.get("token_estimate") or 0)
            economy["semantic_cache_events"] += 1
            economy["semantic_cache_items"] += items
            economy["context_tokens_sent"] += token_estimate
            economy["citations_available"] += len(citations)
            phase_citation_supply[phase] = phase_citation_supply.get(phase, 0) + len(citations)
        elif event_type == "phase_completed":
            citations = data.get("citations") or []
            economy["citations_used"] += len(citations)
            phase_citation_use[phase] = phase_citation_use.get(phase, 0) + len(citations)
        elif event_type == "llm_call":
            usage = data.get("usage") or {}
            economy["prompt_tokens_observed"] += int(usage.get("prompt_tokens") or usage.get("input_tokens") or 0)

    economy["tokens_avoided_estimate"] = max(0, economy["candidate_tokens_seen"] - economy["context_tokens_sent"])
    economy["poor_retrieval_phases"] = [
        phase
        for phase, supplied in phase_citation_supply.items()
        if supplied > 0 and phase_citation_use.get(phase, 0) == 0
    ][:8]
    try:
        with psycopg.connect(db_dsn()) as conn:
            eval_rows = conn.execute(
                """
                SELECT phase, status, score
                FROM retrieval_evals
                WHERE project_id = %s
                ORDER BY created_at DESC
                LIMIT 100
                """,
                (project_id,),
            ).fetchall()
    except Exception:
        eval_rows = []

    if eval_rows:
        statuses: Dict[str, int] = {}
        total_score = 0.0
        failed_phases: List[str] = []
        for phase, status, score in eval_rows:
            status_key = str(status or "unknown")
            statuses[status_key] = statuses.get(status_key, 0) + 1
            total_score += float(score or 0)
            if status_key in {"unused_context", "cited_unknown"}:
                failed_phases.append(str(phase))
        economy["retrieval_eval_count"] = len(eval_rows)
        economy["retrieval_eval_score"] = round(total_score / len(eval_rows), 4)
        economy["retrieval_eval_statuses"] = statuses
        economy["failed_retrieval_phases"] = sorted(set(failed_phases))[:8]
    try:
        with psycopg.connect(db_dsn()) as conn:
            quality_rows = conn.execute(
                """
                SELECT phase, status, score, risky_tool_calls_count, duplicate_tool_calls_count
                FROM phase_quality_evals
                WHERE project_id = %s
                ORDER BY created_at DESC
                LIMIT 100
                """,
                (project_id,),
            ).fetchall()
    except Exception:
        quality_rows = []

    if quality_rows:
        statuses: Dict[str, int] = {}
        total_score = 0.0
        failed_phases: List[str] = []
        side_effect_warnings = 0
        for phase, status, score, risky_count, duplicate_count in quality_rows:
            status_key = str(status or "unknown")
            statuses[status_key] = statuses.get(status_key, 0) + 1
            total_score += float(score or 0)
            if status_key in {"warning", "failed"}:
                failed_phases.append(str(phase))
            if int(risky_count or 0) > 0 or int(duplicate_count or 0) > 0:
                side_effect_warnings += 1
        economy["quality_eval_count"] = len(quality_rows)
        economy["quality_eval_score"] = round(total_score / len(quality_rows), 4)
        economy["quality_eval_statuses"] = statuses
        economy["quality_failed_phases"] = sorted(set(failed_phases))[:8]
        economy["side_effect_warnings"] = side_effect_warnings
    try:
        with psycopg.connect(db_dsn()) as conn:
            contract_rows = conn.execute(
                """
                SELECT valid, autofixed, issues
                FROM phase_contract_evals
                WHERE project_id = %s
                ORDER BY created_at DESC
                LIMIT 100
                """,
                (project_id,),
            ).fetchall()
    except Exception:
        contract_rows = []

    if contract_rows:
        valid_count = 0
        autofix_count = 0
        issue_count = 0
        for valid, autofixed, issues in contract_rows:
            if bool(valid):
                valid_count += 1
            if bool(autofixed):
                autofix_count += 1
            issue_list = issues or []
            if isinstance(issue_list, str):
                try:
                    issue_list = json.loads(issue_list)
                except Exception:
                    issue_list = []
            issue_count += len(issue_list) if isinstance(issue_list, list) else 0
        economy["contract_eval_count"] = len(contract_rows)
        economy["contract_valid_count"] = valid_count
        economy["contract_autofix_count"] = autofix_count
        economy["contract_issue_count"] = issue_count
    try:
        with psycopg.connect(db_dsn()) as conn:
            idempotency_row = conn.execute(
                """
                SELECT COUNT(*), COALESCE(SUM(hit_count), 0)
                FROM tool_idempotency_records
                WHERE project_id = %s
                """,
                (project_id,),
            ).fetchone()
    except Exception:
        idempotency_row = None

    if idempotency_row:
        hits = int(idempotency_row[1] or 0)
        economy["idempotency_records"] = int(idempotency_row[0] or 0)
        economy["idempotency_hits"] = hits
        economy["idempotency_replays_prevented"] = hits
    return economy


def project_usage_summary(project_id: str) -> Dict[str, Any]:
    summary = empty_project_usage_summary(project_id)
    try:
        with psycopg.connect(db_dsn()) as conn:
            total_row = conn.execute(
                """
                SELECT COUNT(*),
                       COALESCE(SUM(prompt_tokens), 0),
                       COALESCE(SUM(completion_tokens), 0),
                       COALESCE(SUM(cached_tokens), 0),
                       COALESCE(SUM(estimated_cost_usd), 0)
                FROM agent_traces
                WHERE project_id = %s
                """,
                (project_id,),
            ).fetchone()
            phase_rows = conn.execute(
                """
                SELECT phase, COUNT(*),
                       COALESCE(SUM(prompt_tokens), 0),
                       COALESCE(SUM(completion_tokens), 0),
                       COALESCE(SUM(cached_tokens), 0),
                       COALESCE(SUM(estimated_cost_usd), 0)
                FROM agent_traces
                WHERE project_id = %s
                GROUP BY phase
                ORDER BY COALESCE(SUM(estimated_cost_usd), 0) DESC,
                         COALESCE(SUM(prompt_tokens + completion_tokens), 0) DESC
                LIMIT 12
                """,
                (project_id,),
            ).fetchall()
            agent_rows = conn.execute(
                """
                SELECT agent, COUNT(*),
                       COALESCE(SUM(prompt_tokens), 0),
                       COALESCE(SUM(completion_tokens), 0),
                       COALESCE(SUM(cached_tokens), 0),
                       COALESCE(SUM(estimated_cost_usd), 0)
                FROM agent_traces
                WHERE project_id = %s
                GROUP BY agent
                ORDER BY COALESCE(SUM(estimated_cost_usd), 0) DESC,
                         COALESCE(SUM(prompt_tokens + completion_tokens), 0) DESC
                LIMIT 12
                """,
                (project_id,),
            ).fetchall()
            model_rows = conn.execute(
                """
                SELECT provider, model, COUNT(*),
                       COALESCE(SUM(prompt_tokens), 0),
                       COALESCE(SUM(completion_tokens), 0),
                       COALESCE(SUM(cached_tokens), 0),
                       COALESCE(SUM(estimated_cost_usd), 0)
                FROM agent_traces
                WHERE project_id = %s
                GROUP BY provider, model
                ORDER BY COALESCE(SUM(estimated_cost_usd), 0) DESC,
                         COALESCE(SUM(prompt_tokens + completion_tokens), 0) DESC
                LIMIT 8
                """,
                (project_id,),
            ).fetchall()
    except Exception:
        return summary

    if total_row:
        prompt_tokens = int(total_row[1] or 0)
        completion_tokens = int(total_row[2] or 0)
        cached_tokens = int(total_row[3] or 0)
        total_cost = round(float(total_row[4] or 0), 6)
        summary["totals"] = {
            "events": int(total_row[0] or 0),
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "cached_tokens": cached_tokens,
            "total_tokens": prompt_tokens + completion_tokens,
            "estimated_cost_usd": total_cost,
        }
        max_cost = summary["budget"]["max_project_cost_usd"]
        if max_cost:
            remaining = round(max(max_cost - total_cost, 0.0), 6)
            summary["budget"] = {
                "max_project_cost_usd": max_cost,
                "remaining_usd": remaining,
                "usage_ratio": round(min(total_cost / max_cost, 1.0), 4),
                "is_exceeded": total_cost >= max_cost,
            }

    summary["by_phase"] = [_usage_row(row, "phase") for row in phase_rows]
    summary["by_agent"] = [_usage_row(row, "agent") for row in agent_rows]
    summary["by_model"] = [
        {
            "provider": row[0],
            "model": row[1],
            "events": int(row[2] or 0),
            "prompt_tokens": int(row[3] or 0),
            "completion_tokens": int(row[4] or 0),
            "cached_tokens": int(row[5] or 0),
            "total_tokens": int(row[3] or 0) + int(row[4] or 0),
            "estimated_cost_usd": round(float(row[6] or 0), 6),
        }
        for row in model_rows
    ]
    summary["context_economy"] = project_context_economy(project_id)
    return summary


def project_estimated_cost(project: ProjectState) -> float:
    usage = project_usage_summary(project.id)
    usage_events = int((usage.get("totals") or {}).get("events") or 0)
    if usage_events:
        return round(float((usage.get("totals") or {}).get("estimated_cost_usd") or 0), 6)

    total = 0.0
    for artifact in project.artifacts:
        content = artifact.get("content") or {}
        try:
            total += float(content.get("estimated_cost_usd") or 0)
        except Exception:
            pass
    return round(total, 6)

async def publish(project_id: str) -> None:
    state = PROJECTS.get(project_id)
    if not state:
        return
    dead: List[WebSocket] = []
    for ws in SUBSCRIBERS.get(project_id, []):
        try:
            await ws.send_text(state.model_dump_json())
        except Exception:
            dead.append(ws)
    for ws in dead:
        SUBSCRIBERS[project_id].remove(ws)

def append_log(project: ProjectState, agent: str, phase: str, message: str, metadata: Optional[Dict[str, Any]] = None) -> None:
    try:
        safe_metadata = json.loads(redact_secrets(metadata or {}))
    except Exception:
        safe_metadata = {"redacted": redact_secrets(metadata or {})}
    log = {
        "id": str(uuid.uuid4()),
        "agent": agent,
        "phase": phase,
        "message": redact_secrets(message),
        "metadata": safe_metadata,
        "created_at": now_iso(),
    }
    project.logs.insert(0, log)
    project.logs = project.logs[:100]
    project.updated_at = now_iso()
    persist_activity_log(project, log)

def add_artifact(project: ProjectState, artifact_type: str, agent: str, title: str, content: Dict[str, Any], uri: Optional[str] = None) -> None:
    artifact = {
        "id": str(uuid.uuid4()),
        "type": artifact_type,
        "agent": agent,
        "title": title,
        "content": content,
        "uri": uri,
        "created_at": now_iso(),
    }
    project.artifacts.insert(0, artifact)
    project.artifacts = project.artifacts[:100]
    project.updated_at = now_iso()
    persist_artifact_record(project, artifact)
    try:
        indexed = index_artifact(project.id, artifact)
        if indexed:
            append_log(project, "system", "memory", f"Indexed {indexed} memory chunk(s) for artifact {title}.")
    except Exception as exc:
        append_log(project, "system", "memory", f"Artifact memory indexing failed: {exc}")


def restore_phase_checkpoint(project: ProjectState, phase_id: str, agent_id: str, checkpoint: Dict[str, Any]) -> None:
    phase = project.phases[phase_id]
    if not any(artifact.get("type") == phase_id for artifact in project.artifacts):
        add_artifact(
            project,
            artifact_type=phase_id,
            agent=agent_id,
            title=f"{phase_id.replace('_', ' ').title()} Artifact",
            content=checkpoint,
        )
    phase["status"] = "completed"
    phase["started_at"] = phase.get("started_at") or now_iso()
    phase["completed_at"] = phase.get("completed_at") or now_iso()
    phase["error"] = None
    persist_trace(
        project,
        phase_id,
        agent_id,
        "phase_checkpoint_reused",
        {"metadata": {"summary": "Reused persisted phase checkpoint without model call."}},
    )
    upsert_phase_run(project, phase_id, "completed", output=checkpoint)
    append_log(project, "system", phase_id, f"Checkpoint reutilizado para {phase_id}; se omitio llamada al modelo.")

def persist_project(project: ProjectState) -> None:
    try:
        state_dump = project.model_dump_json()
        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            conn.execute(
                """
                INSERT INTO projects (id, name, client_goal, budget, status, current_phase, state_dump)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    client_goal = EXCLUDED.client_goal,
                    budget = EXCLUDED.budget,
                    status = EXCLUDED.status,
                    current_phase = EXCLUDED.current_phase,
                    state_dump = EXCLUDED.state_dump,
                    updated_at = NOW()
                """,
                (project.id, project.name, project.client_goal, project.budget, project.status, project.current_phase, state_dump),
            )
    except Exception as exc:
        append_log(project, "system", "storage", f"Knowledge DB persist failed: {exc}")

def load_projects() -> None:
    to_persist = []
    try:
        with psycopg.connect(db_dsn()) as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT id, name, client_goal, budget, status, current_phase, state_dump, created_at, updated_at FROM projects")
                for row in cur:
                    row_id, row_name, row_client_goal, row_budget, row_status, row_current_phase, state_dump, row_created_at, row_updated_at = row
                    
                    state = None
                    if state_dump:
                        try:
                            # state_dump is parsed as dict by psycopg3 if JSONB, but model_dump_json() creates a string.
                            # So it could be a string or a dict.
                            state = ProjectState.model_validate(state_dump if isinstance(state_dump, dict) else json.loads(state_dump))
                        except Exception as e:
                            print(f"Error validating state_dump for project {row_id}: {e}")
                    
                    if not state:
                        # Fallback reconstruction from columns
                        try:
                            state = ProjectState(
                                id=str(row_id),
                                name=row_name,
                                client_goal=row_client_goal,
                                budget=row_budget,
                                status=row_status if row_status in ["created", "running", "waiting_approval", "waiting_intervention", "completed", "failed"] else "created",
                                current_phase=row_current_phase or "ceo",
                                phases=build_initial_phases(),
                                artifacts=[],
                                logs=[],
                                created_at=row_created_at.isoformat() if hasattr(row_created_at, "isoformat") else str(row_created_at),
                                updated_at=row_updated_at.isoformat() if hasattr(row_updated_at, "isoformat") else str(row_updated_at),
                            )
                            to_persist.append(state)
                            print(f"Queueing project {row_id} ({row_name}) for persistence")
                        except Exception as e:
                            print(f"Failed to reconstruct project {row_id}: {e}")
                            
                    if state:
                        PROJECTS[state.id] = state
                        reindex_project_memory(state.id, state.artifacts)
    except Exception as exc:
        print(f"Failed to load projects from DB: {exc}")

    # Persist reconstructed states after connection is closed
    for state in to_persist:
        try:
            persist_project(state)
            print(f"Successfully persisted reconstructed project {state.id} ({state.name})")
        except Exception as e:
            print(f"Failed to persist reconstructed project {state.id}: {e}")


def phase_ready(project: ProjectState, phase_id: str) -> bool:
    phase = project.phases[phase_id]
    return all(project.phases[dep]["status"] == "completed" for dep in phase["depends_on"])

def runnable_phases(project: ProjectState) -> List[str]:
    # IDs of static phases
    static_phase_ids = {phase["id"] for phase in PHASES}

    # Static phases that are pending and ready
    static_ready = [
        phase["id"]
        for phase in PHASES
        if phase["id"] in project.phases
        and project.phases[phase["id"]]["status"] == "pending"
        and phase_ready(project, phase["id"])
    ]

    # Dynamic phases (e.g. chat iteration phases) not in the static list
    dynamic_ready = [
        phase_id
        for phase_id, phase in project.phases.items()
        if phase_id not in static_phase_ids
        and phase["status"] == "pending"
        and phase_ready(project, phase_id)
    ]

    return static_ready + dynamic_ready


async def broadcast_token(project_id: str, phase_id: str, token: str) -> None:
    payload = json.dumps({"type": "token", "phase": phase_id, "token": token})
    for ws in SUBSCRIBERS.get(project_id, []):
        try:
            await ws.send_text(payload)
        except Exception:
            pass

async def artifact_for_phase(project: ProjectState, phase_id: str, agent_id: str, override_goal: str = None) -> Dict[str, Any]:
    agents = load_agents().get("agents", {})
    agent = agents.get(agent_id, {})
    query_text = f"{project.client_goal}\n{override_goal or ''}\n{agent.get('display_name', agent_id)}\n{' '.join(agent.get('deliverables', []))}"
    
    async def log_callback(msg: str):
        append_log(project, agent_id, phase_id, msg)
        persist_trace(
            project,
            phase_id,
            agent_id,
            "tool_event",
            {"metadata": {"message": msg}},
        )
        await publish(project.id)
        
    async def token_callback(token: str):
        await broadcast_token(project.id, phase_id, token)

    async def trace_callback(event_type: str, metadata: Dict[str, Any]):
        content = {"metadata": metadata}
        if event_type == "llm_call":
            content["model"] = metadata.get("model")
            content["provider"] = metadata.get("provider")
        persist_trace(
            project,
            phase_id,
            agent_id,
            event_type,
            content,
        )
        await publish(project.id)
        
    catalog = load_mcp_catalog()
    enabled_mcp = []
    disabled_mcp = []
    for name, srv in catalog.get("servers", {}).items():
        if srv.get("enabled", True):
            enabled_mcp.append(name)
            enabled_mcp.append(f"{name}_mcp")
        else:
            disabled_mcp.append(name)
            disabled_mcp.append(f"{name}_mcp")
            
    builtins = ["execute_command", "write_file", "read_file", "web_search", "get_weather", "convert_currency", "fetch_url", "download_resource", "generate_image", "edit_image", "knowledge_base"]
    enabled_mcp.extend(builtins)

    cached_output = reusable_semantic_phase_output(project.id, phase_id, agent_id, query_text)
    if cached_output:
        persist_trace(
            project,
            phase_id,
            agent_id,
            "semantic_cache_reused",
            {"metadata": {"exact_match": True, "summary": cached_output.get("summary")}},
        )
        append_log(project, "system", "semantic_cache", f"Reused exact semantic cache for {phase_id}; model call skipped.")
        return cached_output

    memory_context = retrieve_project_memory(
        project_id=project.id,
        phase_id=phase_id,
        query=query_text,
    )
    semantic_context = retrieve_semantic_phase_cache(project.id, phase_id, agent_id, query_text)
    combined_context = [*semantic_context, *memory_context]
    if semantic_context:
        token_estimate = sum(int(item.get("token_estimate") or 0) for item in semantic_context)
        append_log(project, "system", "semantic_cache", f"Retrieved {len(semantic_context)} semantic cache item(s) for {phase_id}.")
        persist_trace(
            project,
            phase_id,
            agent_id,
            "semantic_cache_retrieved",
            {
                "metadata": {
                    "items": len(semantic_context),
                    "token_estimate": token_estimate,
                    "citations": [item.get("citation") for item in semantic_context if item.get("citation")],
                    "scores": [
                        {
                            "citation": item.get("citation"),
                            "score": item.get("score"),
                            "lexical_score": item.get("lexical_score"),
                            "vector_score": item.get("vector_score"),
                            "exact_match": item.get("exact_match"),
                        }
                        for item in semantic_context
                    ],
                }
            },
        )
    if memory_context:
        token_estimate = sum(int(item.get("token_estimate") or 0) for item in memory_context)
        candidate_tokens = sum(int(item.get("candidate_token_estimate") or item.get("token_estimate") or 0) for item in memory_context)
        append_log(project, "system", "memory", f"Retrieved {len(memory_context)} memory chunk(s) for {phase_id}.")
        persist_trace(
            project,
            phase_id,
            agent_id,
            "memory_retrieved",
            {
                "metadata": {
                    "chunks": len(memory_context),
                    "token_estimate": token_estimate,
                    "candidate_tokens": candidate_tokens,
                    "citations": [item.get("citation") for item in memory_context if item.get("citation")],
                    "memory_ids": [item.get("memory_id") for item in memory_context if item.get("memory_id")],
                    "scores": [
                        {
                            "citation": item.get("citation"),
                            "score": item.get("score"),
                            "lexical_score": item.get("lexical_score"),
                            "vector_score": item.get("vector_score"),
                        }
                        for item in memory_context
                    ],
                }
            },
        )
        
    return await generate_phase_artifact(
        phase_id=phase_id,
        agent_id=agent_id,
        agent=agent,
        project_name=project.name,
        client_goal=override_goal if override_goal else project.client_goal,
        budget=project.budget,
        existing_artifacts=project.artifacts,
        memory_context=combined_context if combined_context else None,
        on_tool_call=log_callback,
        on_trace=trace_callback,
        on_token=token_callback,
        enabled_tools=enabled_mcp,
        disabled_tools=disabled_mcp,
        project_id=project.id,
    )

async def execute_phase(project: ProjectState, phase_id: str) -> None:
    phase = project.phases[phase_id]
    agent_id = phase["agent"]
    if not phase.get("goal_override"):
        checkpoint = load_phase_checkpoint(project.id, phase_id)
        if checkpoint:
            restore_phase_checkpoint(project, phase_id, agent_id, checkpoint)
            persist_project(project)
            await publish(project.id)
            return

    phase["status"] = "running"
    phase["started_at"] = now_iso()
    project.current_phase = phase_id
    project.status = "running"
    append_log(project, agent_id, phase_id, f"{agent_id} started {phase_id}")
    persist_trace(project, phase_id, agent_id, "phase_started", {"metadata": {"status": "running"}})
    upsert_phase_run(project, phase_id, "running")
    await publish(project.id)

    if phase_id == "founder_approval":
        project.status = "waiting_approval"
        append_log(project, "ceo", phase_id, "Contrato listo. Esperando aprobacion del fundador para continuar.")
        upsert_phase_run(project, phase_id, "waiting_approval")
        await publish(project.id)
        return

    try:
        goal_override = phase.get("goal_override")
        content = await artifact_for_phase(project, phase_id, agent_id, override_goal=goal_override)
    except Exception as exc:
        error_message = str(exc)
        if error_message.startswith("TOOL_APPROVAL_REQUIRED:"):
            phase["status"] = "failed"
            phase["error"] = error_message.replace("TOOL_APPROVAL_REQUIRED: ", "", 1)
            upsert_phase_run(project, phase_id, "failed", error=phase["error"])
            persist_trace(project, phase_id, agent_id, "tool_approval_required", {"metadata": {"error": phase["error"]}})
            project.status = "waiting_intervention"
            append_log(project, "tool_policy", phase_id, f"Aprobacion requerida antes de continuar: {phase['error']}")
            persist_project(project)
            await publish(project.id)
            return
        if agent_id != "debugger":
            append_log(project, "system", phase_id, f"⚠️ Error en {agent_id}. Invocando a Debugger Agent...")
            try:
                debugger_goal = f"FIX THIS ERROR for phase '{phase_id}' and agent '{agent_id}'. The error was:\n{exc}\n\nOriginal Project Goal: {project.client_goal}\nUse your tools to fix the code, dependencies or config. Once fixed, output your result."
                await artifact_for_phase(project, phase_id, "debugger", override_goal=debugger_goal)
                append_log(project, "debugger", phase_id, "✅ Error solucionado por Debugger. Reanudando agente original...")
                return await execute_phase(project, phase_id)
            except Exception as debugger_exc:
                phase["status"] = "failed"
                phase["error"] = f"Original error: {exc} | Debugger error: {debugger_exc}"
                upsert_phase_run(project, phase_id, "failed", error=phase["error"])
                persist_trace(project, phase_id, agent_id, "phase_failed", {"metadata": {"error": phase["error"]}})
                project.status = "waiting_intervention"
                append_log(project, agent_id, phase_id, f"❌ Error crítico. Debugger falló: {debugger_exc}. Esperando intervención.")
                persist_project(project)
                await publish(project.id)
                return
        else:
            phase["status"] = "failed"
            phase["error"] = str(exc)
            upsert_phase_run(project, phase_id, "failed", error=phase["error"])
            persist_trace(project, phase_id, agent_id, "phase_failed", {"metadata": {"error": phase["error"]}})
            project.status = "waiting_intervention"
            append_log(project, agent_id, phase_id, f"❌ Error en {agent_id} durante {phase_id}: {exc}. Esperando intervención del fundador.")
            persist_project(project)
            await publish(project.id)
            return

    add_artifact(
        project,
        artifact_type=phase_id,
        agent=agent_id,
        title=f"{phase_id.replace('_', ' ').title()} Artifact",
        content=content,
    )
    
    # Dynamic graph expansion
    next_inputs = content.get("next_required_inputs", [])
    if next_inputs:
        for required_agent in next_inputs:
            dynamic_phase_id = f"{required_agent}_{str(uuid.uuid4())[:8]}"
            project.phases[dynamic_phase_id] = {
                "id": dynamic_phase_id,
                "agent": required_agent,
                "depends_on": [phase_id],
                "status": "pending",
                "started_at": None,
                "completed_at": None,
                "error": None,
            }
            if "done" in project.phases and dynamic_phase_id not in project.phases["done"]["depends_on"]:
                project.phases["done"]["depends_on"].append(dynamic_phase_id)
            append_log(project, "system", "router", f"Dynamically added phase {dynamic_phase_id} for {required_agent}")
            
    phase["status"] = "completed"
    phase["completed_at"] = now_iso()
    persist_trace(project, phase_id, agent_id, "phase_completed", content)
    persist_retrieval_eval(project, phase_id, agent_id, content)
    persist_phase_contract_eval(project, phase_id, agent_id, content)
    persist_phase_quality_eval(project, phase_id, agent_id, content)
    upsert_phase_run(project, phase_id, "completed", output=content)
    try:
        agent_cfg = load_agents().get("agents", {}).get(agent_id, {})
        cache_query = f"{project.client_goal}\n{phase.get('goal_override') or ''}\n{agent_cfg.get('display_name', agent_id)}\n{' '.join(agent_cfg.get('deliverables', []))}"
        store_semantic_phase_cache(project.id, phase_id, agent_id, cache_query, content)
        persist_trace(
            project,
            phase_id,
            agent_id,
            "semantic_cache_stored",
            {
                "metadata": {
                    "citations": content.get("citations", []),
                    "summary": content.get("summary"),
                }
            },
        )
    except Exception:
        pass
    append_log(project, agent_id, phase_id, f"{agent_id} completed {phase_id}")
    limit = project_cost_limit()
    if limit and project_estimated_cost(project) > limit:
        project.status = "waiting_intervention"
        append_log(project, "system", "budget", f"Presupuesto de costo alcanzado: {project_estimated_cost(project)} USD > {limit} USD.")
        persist_project(project)
        await publish(project.id)
        return
    if phase_id == "done":
        project.status = "completed"
    persist_project(project)
    await publish(project.id)

async def run_project(project_id: str) -> None:
    project = PROJECTS[project_id]
    lock = RUN_LOCKS.setdefault(project_id, asyncio.Lock())
    task = asyncio.current_task()
    PROJECT_TASKS[project_id] = task
    
    try:
        async with lock:
            while project.status not in {"completed", "failed", "waiting_approval", "waiting_intervention"}:
                ready = runnable_phases(project)
                if not ready:
                    project.status = "failed"
                    append_log(project, "ceo", project.current_phase, "No runnable phases found. Check dependency state.")
                    await publish(project.id)
                    return

                if len(ready) > 1:
                    await asyncio.gather(*(execute_phase(project, phase) for phase in ready))
                else:
                    await execute_phase(project, ready[0])

                if project.status == "waiting_approval":
                    return
    except asyncio.CancelledError:
        append_log(project, "system", "control", "Proceso de orquestación abortado (CancelledError).")
        raise
    finally:
        if PROJECT_TASKS.get(project_id) == task:
            del PROJECT_TASKS[project_id]
