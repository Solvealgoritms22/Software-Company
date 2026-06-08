import json
from typing import Any, Dict

import psycopg

from database import db_dsn
from models import ProjectState
from token_budget import project_cost_limit


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
