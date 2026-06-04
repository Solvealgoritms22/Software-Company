import json
import os
from typing import Any, Dict, List, Optional

import psycopg
from psycopg.types.json import Jsonb

from artifact_memory import create_embedding, normalize_terms, vector_literal
from database import db_dsn
from token_budget import compact_text, estimate_tokens, stable_hash


DEFAULT_MAX_ITEMS = 3
DEFAULT_CONTEXT_TOKENS = 1_200
DEFAULT_MIN_SCORE = 0.72
DEFAULT_CANDIDATES = 100


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
        return value if value > 0 else default
    except Exception:
        return default


def _float_env(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
        return value if 0 <= value <= 1 else default
    except Exception:
        return default


def semantic_cache_enabled() -> bool:
    return os.getenv("SEMANTIC_CACHE_ENABLED", "true").lower() not in {"0", "false", "no"}


def semantic_cache_auto_reuse() -> bool:
    return os.getenv("SEMANTIC_CACHE_AUTO_REUSE", "false").lower() in {"1", "true", "yes"}


def semantic_cache_min_score() -> float:
    return _float_env("SEMANTIC_CACHE_MIN_SCORE", DEFAULT_MIN_SCORE)


def semantic_cache_max_items() -> int:
    return _int_env("SEMANTIC_CACHE_MAX_ITEMS", DEFAULT_MAX_ITEMS)


def semantic_cache_context_tokens() -> int:
    return _int_env("SEMANTIC_CACHE_CONTEXT_TOKENS", DEFAULT_CONTEXT_TOKENS)


def semantic_cache_candidates() -> int:
    return _int_env("SEMANTIC_CACHE_CANDIDATES", DEFAULT_CANDIDATES)


def phase_signature_hash(phase_id: str, agent_id: str, query_text: str) -> str:
    return stable_hash({"phase": phase_id, "agent": agent_id, "query": query_text})


def output_text(content: Dict[str, Any]) -> str:
    deliverables = content.get("deliverables") or {}
    return compact_text(
        {
            "summary": content.get("summary"),
            "deliverables": deliverables,
            "risks": content.get("risks", []),
            "citations": content.get("citations", []),
        },
        6_000,
    )


def lexical_score(text: str, query: str) -> float:
    terms = normalize_terms(query)
    if not terms:
        return 0.0
    lower = text.lower()
    hits = sum(1 for term in set(terms) if term in lower)
    return hits / max(len(set(terms)), 1)


def store_semantic_phase_cache(
    project_id: str,
    phase_id: str,
    agent_id: str,
    query_text: str,
    output: Dict[str, Any],
) -> None:
    if not semantic_cache_enabled():
        return
    summary = compact_text(output_text(output), 3_500)
    signature_hash = phase_signature_hash(phase_id, agent_id, query_text)
    embedding = create_embedding(f"{query_text}\n{summary}")
    try:
        with psycopg.connect(db_dsn(), autocommit=True) as conn:
            conn.execute(
                """
                INSERT INTO semantic_phase_cache (
                    project_id, phase, agent, signature_hash, query_text, output_summary,
                    output, citations, token_estimate, embedding, metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s)
                ON CONFLICT (signature_hash) DO UPDATE SET
                    output_summary = EXCLUDED.output_summary,
                    output = EXCLUDED.output,
                    citations = EXCLUDED.citations,
                    token_estimate = EXCLUDED.token_estimate,
                    embedding = COALESCE(EXCLUDED.embedding, semantic_phase_cache.embedding),
                    metadata = EXCLUDED.metadata,
                    created_at = NOW()
                """,
                (
                    project_id,
                    phase_id,
                    agent_id,
                    signature_hash,
                    query_text,
                    summary,
                    Jsonb(output),
                    Jsonb(output.get("citations") or []),
                    estimate_tokens(summary),
                    vector_literal(embedding) if embedding else None,
                    Jsonb({"source": "phase_output"}),
                ),
            )
    except Exception:
        return


def retrieve_semantic_phase_cache(
    project_id: str,
    phase_id: str,
    agent_id: str,
    query_text: str,
    max_tokens: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not semantic_cache_enabled():
        return []
    max_tokens = max_tokens or semantic_cache_context_tokens()
    signature_hash = phase_signature_hash(phase_id, agent_id, query_text)
    try:
        with psycopg.connect(db_dsn()) as conn:
            rows = conn.execute(
                """
                SELECT id, phase, agent, signature_hash, output_summary, output,
                       citations, token_estimate, metadata, created_at,
                       NULL::double precision AS vector_score
                FROM semantic_phase_cache
                WHERE project_id = %s
                  AND agent = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (project_id, agent_id, semantic_cache_candidates()),
            ).fetchall()
            query_embedding = create_embedding(query_text)
            if query_embedding:
                query_vector = vector_literal(query_embedding)
                vector_rows = conn.execute(
                    """
                    SELECT id, phase, agent, signature_hash, output_summary, output,
                           citations, token_estimate, metadata, created_at,
                           GREATEST(0, 1 - (embedding <=> %s::vector)) AS vector_score
                    FROM semantic_phase_cache
                    WHERE project_id = %s
                      AND agent = %s
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (query_vector, project_id, agent_id, query_vector, semantic_cache_candidates()),
                ).fetchall()
                rows = list(rows) + list(vector_rows)
    except Exception:
        return []

    by_id: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        cache_id = str(row[0])
        summary = row[4] or ""
        item = by_id.get(cache_id) or {
            "cache_id": cache_id,
            "phase": row[1],
            "agent": row[2],
            "signature_hash": row[3],
            "summary": summary,
            "output": row[5] or {},
            "citations": row[6] or [],
            "token_estimate": int(row[7] or 0),
            "metadata": row[8] or {},
            "created_at": row[9].isoformat() if hasattr(row[9], "isoformat") else str(row[9]),
            "vector_score": 0.0,
        }
        item["vector_score"] = max(float(row[10] or 0), float(item.get("vector_score") or 0))
        item["lexical_score"] = lexical_score(summary, query_text)
        item["exact_match"] = row[3] == signature_hash
        by_id[cache_id] = item

    ranked: List[Dict[str, Any]] = []
    for item in by_id.values():
        phase_bonus = 0.08 if item.get("phase") == phase_id else 0.0
        score = 1.0 if item["exact_match"] else min(1.0, max(float(item.get("vector_score") or 0), float(item.get("lexical_score") or 0)) + phase_bonus)
        item["score"] = round(score, 4)
        if item["exact_match"] or item["score"] >= semantic_cache_min_score():
            ranked.append(item)

    ranked.sort(key=lambda item: (item["score"], item["created_at"]), reverse=True)
    selected: List[Dict[str, Any]] = []
    spent = 0
    for item in ranked:
        token_estimate = item["token_estimate"] or estimate_tokens(item["summary"])
        if selected and spent + token_estimate > max_tokens:
            continue
        selected.append(
            {
                "source": "semantic_cache",
                "citation": f"semantic-cache:{item['cache_id']}",
                "cache_id": item["cache_id"],
                "phase": item["phase"],
                "agent": item["agent"],
                "score": item["score"],
                "lexical_score": round(float(item.get("lexical_score") or 0), 4),
                "vector_score": round(float(item.get("vector_score") or 0), 4),
                "exact_match": item["exact_match"],
                "summary": compact_text(item["summary"], 1_500),
                "citations": item.get("citations") or [],
                "token_estimate": token_estimate,
            }
        )
        spent += token_estimate
        if len(selected) >= semantic_cache_max_items() or spent >= max_tokens:
            break
    return selected


def reusable_semantic_phase_output(
    project_id: str,
    phase_id: str,
    agent_id: str,
    query_text: str,
) -> Optional[Dict[str, Any]]:
    if not semantic_cache_auto_reuse():
        return None
    signature_hash = phase_signature_hash(phase_id, agent_id, query_text)
    try:
        with psycopg.connect(db_dsn()) as conn:
            row = conn.execute(
                """
                SELECT output
                FROM semantic_phase_cache
                WHERE project_id = %s
                  AND phase = %s
                  AND agent = %s
                  AND signature_hash = %s
                LIMIT 1
                """,
                (project_id, phase_id, agent_id, signature_hash),
            ).fetchone()
    except Exception:
        return None
    if not row or not isinstance(row[0], dict):
        return None
    output = dict(row[0])
    output.setdefault("metadata", {})
    output["metadata"]["semantic_cache_reused"] = True
    return output
