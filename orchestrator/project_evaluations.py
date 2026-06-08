import json
from typing import Any, Dict, List

import psycopg
from psycopg.types.json import Jsonb

from config_manager import load_agents
from database import db_dsn
from models import ProjectState
from project_db import _db_execute
from project_traces import persist_trace


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
