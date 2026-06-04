import json
import os
import re
from typing import Any, Dict, Iterable, List, Optional

import psycopg
from psycopg.types.json import Jsonb

from database import db_dsn
from token_budget import compact_text, estimate_tokens, stable_hash


DEFAULT_CHUNK_CHARS = 1_400
DEFAULT_MAX_CHUNKS_PER_ARTIFACT = 10
DEFAULT_MAX_CANDIDATE_CHUNKS = 500
DEFAULT_MEMORY_CONTEXT_TOKENS = 4_000

PHASE_IMPORTANCE = {
    "analysis": 4,
    "legal_contract": 2,
    "architecture": 5,
    "senior_backend": 4,
    "backend_development": 3,
    "frontend_architecture": 4,
    "frontend_development": 3,
    "database": 4,
    "qa": 3,
    "security": 4,
    "devops": 3,
    "documentation": 2,
}


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
        return value if value > 0 else default
    except Exception:
        return default


def memory_enabled() -> bool:
    return os.getenv("ARTIFACT_MEMORY_ENABLED", "true").lower() not in {"0", "false", "no"}


def chunk_chars() -> int:
    return _int_env("ARTIFACT_MEMORY_CHUNK_CHARS", DEFAULT_CHUNK_CHARS)


def max_chunks_per_artifact() -> int:
    return _int_env("ARTIFACT_MEMORY_MAX_CHUNKS_PER_ARTIFACT", DEFAULT_MAX_CHUNKS_PER_ARTIFACT)


def max_candidate_chunks() -> int:
    return _int_env("ARTIFACT_MEMORY_MAX_CANDIDATE_CHUNKS", DEFAULT_MAX_CANDIDATE_CHUNKS)


def memory_context_tokens() -> int:
    return _int_env("ARTIFACT_MEMORY_CONTEXT_TOKENS", DEFAULT_MEMORY_CONTEXT_TOKENS)


def normalize_terms(value: str) -> List[str]:
    terms = re.findall(r"[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+", value.lower())
    return [term for term in terms if len(term) >= 3]


def artifact_text(artifact: Dict[str, Any]) -> str:
    content = artifact.get("content", {})
    if isinstance(content, str):
        content_text = content
    else:
        content_text = json.dumps(content, ensure_ascii=False, sort_keys=True, default=str)
    parts = [
        f"type: {artifact.get('type', '')}",
        f"agent: {artifact.get('agent', '')}",
        f"title: {artifact.get('title', '')}",
        f"uri: {artifact.get('uri', '')}",
        content_text,
    ]
    return compact_text("\n".join(parts), chunk_chars() * max_chunks_per_artifact() * 2)


def chunk_text(text: str, size: Optional[int] = None) -> List[str]:
    size = size or chunk_chars()
    text = re.sub(r"\s+", " ", text).strip()
    if not text:
        return []
    chunks: List[str] = []
    start = 0
    overlap = max(120, size // 10)
    while start < len(text) and len(chunks) < max_chunks_per_artifact():
        end = min(len(text), start + size)
        if end < len(text):
            boundary = text.rfind(" ", start + int(size * 0.65), end)
            if boundary > start:
                end = boundary
        chunks.append(text[start:end].strip())
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return [chunk for chunk in chunks if chunk]


def index_artifact(project_id: str, artifact: Dict[str, Any]) -> int:
    if not memory_enabled():
        return 0
    source_text = artifact_text(artifact)
    content_hash = stable_hash(
        {
            "type": artifact.get("type"),
            "agent": artifact.get("agent"),
            "title": artifact.get("title"),
            "uri": artifact.get("uri"),
            "content": artifact.get("content", {}),
        }
    )
    chunks = chunk_text(source_text)
    if not chunks:
        return 0

    indexed = 0
    with psycopg.connect(db_dsn(), autocommit=True) as conn:
        conn.execute("DELETE FROM artifact_memory_chunks WHERE artifact_id = %s AND content_hash <> %s", (artifact["id"], content_hash))
        for idx, chunk in enumerate(chunks):
            conn.execute(
                """
                INSERT INTO artifact_memory_chunks (
                    project_id, artifact_id, chunk_index, artifact_type, agent, title,
                    content_hash, search_text, token_estimate, metadata, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (artifact_id, chunk_index) DO UPDATE SET
                    project_id = EXCLUDED.project_id,
                    artifact_type = EXCLUDED.artifact_type,
                    agent = EXCLUDED.agent,
                    title = EXCLUDED.title,
                    content_hash = EXCLUDED.content_hash,
                    search_text = EXCLUDED.search_text,
                    token_estimate = EXCLUDED.token_estimate,
                    metadata = EXCLUDED.metadata
                """,
                (
                    project_id,
                    artifact["id"],
                    idx,
                    artifact.get("type", ""),
                    artifact.get("agent", ""),
                    artifact.get("title", ""),
                    content_hash,
                    chunk,
                    estimate_tokens(chunk),
                    Jsonb({"uri": artifact.get("uri"), "created_at": artifact.get("created_at")}),
                    artifact.get("created_at"),
                ),
            )
            indexed += 1
    return indexed


def reindex_project_memory(project_id: str, artifacts: Iterable[Dict[str, Any]]) -> int:
    total = 0
    for artifact in artifacts:
        try:
            total += index_artifact(project_id, artifact)
        except Exception:
            continue
    return total


def score_chunk(row: Dict[str, Any], terms: List[str], phase_id: str) -> int:
    text = f"{row.get('artifact_type', '')} {row.get('agent', '')} {row.get('title', '')} {row.get('search_text', '')}".lower()
    score = 0
    for term in terms:
        score += text.count(term)
    artifact_type = str(row.get("artifact_type") or "")
    if artifact_type == phase_id:
        score += 5
    score += PHASE_IMPORTANCE.get(artifact_type, 0)
    if row.get("chunk_index") == 0:
        score += 1
    return score


def retrieve_project_memory(
    project_id: str,
    phase_id: str,
    query: str,
    max_tokens: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not memory_enabled():
        return []
    max_tokens = max_tokens or memory_context_tokens()
    terms = normalize_terms(f"{phase_id} {query}")
    if not terms:
        terms = normalize_terms(phase_id)

    try:
        with psycopg.connect(db_dsn()) as conn:
            rows = conn.execute(
                """
                SELECT id, artifact_id, chunk_index, artifact_type, agent, title,
                       search_text, token_estimate, metadata, created_at
                FROM artifact_memory_chunks
                WHERE project_id = %s
                ORDER BY created_at DESC, chunk_index ASC
                LIMIT %s
                """,
                (project_id, max_candidate_chunks()),
            ).fetchall()
    except Exception:
        return []

    candidates: List[Dict[str, Any]] = []
    for row in rows:
        item = {
            "memory_id": str(row[0]),
            "artifact_id": str(row[1]),
            "chunk_index": int(row[2]),
            "artifact_type": row[3],
            "agent": row[4],
            "title": row[5],
            "search_text": row[6],
            "token_estimate": int(row[7] or 0),
            "metadata": row[8] or {},
            "created_at": row[9].isoformat() if hasattr(row[9], "isoformat") else str(row[9]),
        }
        item["score"] = score_chunk(item, terms, phase_id)
        candidates.append(item)

    ranked = sorted(candidates, key=lambda item: (item["score"], item["created_at"]), reverse=True)
    selected: List[Dict[str, Any]] = []
    spent = 0
    seen = set()
    for item in ranked:
        if item["score"] <= 0 and selected:
            continue
        key = (item["artifact_id"], item["chunk_index"])
        if key in seen:
            continue
        token_estimate = item["token_estimate"] or estimate_tokens(item["search_text"])
        if selected and spent + token_estimate > max_tokens:
            continue
        selected.append(
            {
                "source": "artifact_memory",
                "artifact_id": item["artifact_id"],
                "chunk": item["chunk_index"],
                "type": item["artifact_type"],
                "agent": item["agent"],
                "title": item["title"],
                "score": item["score"],
                "summary": compact_text(item["search_text"], chunk_chars()),
                "uri": (item.get("metadata") or {}).get("uri"),
            }
        )
        seen.add(key)
        spent += token_estimate
        if spent >= max_tokens:
            break
    return selected
