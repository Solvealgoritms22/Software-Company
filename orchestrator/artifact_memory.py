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
DEFAULT_VECTOR_CANDIDATES = 80
DEFAULT_EMBEDDING_DIMENSIONS = 768
DEFAULT_HYBRID_ALPHA = 0.65

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


def _float_env(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
        return value if 0 <= value <= 1 else default
    except Exception:
        return default


def memory_enabled() -> bool:
    return os.getenv("ARTIFACT_MEMORY_ENABLED", "true").lower() not in {"0", "false", "no"}


def embeddings_enabled() -> bool:
    return os.getenv("ARTIFACT_MEMORY_EMBEDDINGS_ENABLED", "false").lower() in {"1", "true", "yes"}


def embedding_provider() -> str:
    return os.getenv("EMBEDDINGS_PROVIDER", "openai").lower()


def embedding_model() -> str:
    return os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")


def embedding_dimensions() -> int:
    return _int_env("EMBEDDING_DIMENSIONS", DEFAULT_EMBEDDING_DIMENSIONS)


def vector_candidate_chunks() -> int:
    return _int_env("ARTIFACT_MEMORY_VECTOR_CANDIDATES", DEFAULT_VECTOR_CANDIDATES)


def hybrid_alpha() -> float:
    return _float_env("ARTIFACT_MEMORY_HYBRID_ALPHA", DEFAULT_HYBRID_ALPHA)


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


def vector_literal(values: List[float]) -> str:
    return "[" + ",".join(f"{float(value):.8f}" for value in values) + "]"


def create_embedding(text: str) -> Optional[List[float]]:
    if not embeddings_enabled() or embedding_provider() != "openai":
        return None
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return None
    try:
        from openai import OpenAI

        client_kwargs: Dict[str, str] = {"api_key": api_key}
        if os.getenv("OPENAI_BASE_URL"):
            client_kwargs["base_url"] = os.getenv("OPENAI_BASE_URL", "")
        client = OpenAI(**client_kwargs)
        response = client.embeddings.create(
            model=embedding_model(),
            input=compact_text(text, 8_000),
            dimensions=embedding_dimensions(),
        )
        embedding = list(response.data[0].embedding)
    except Exception:
        return None
    if len(embedding) != embedding_dimensions():
        return None
    return [float(value) for value in embedding]


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
            embedding = create_embedding(chunk)
            metadata = {
                "uri": artifact.get("uri"),
                "created_at": artifact.get("created_at"),
                "embedding_provider": embedding_provider() if embedding else None,
                "embedding_model": embedding_model() if embedding else None,
                "embedding_dimensions": len(embedding) if embedding else None,
            }
            conn.execute(
                """
                INSERT INTO artifact_memory_chunks (
                    project_id, artifact_id, chunk_index, artifact_type, agent, title,
                    content_hash, search_text, token_estimate, embedding, metadata, created_at
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s, %s)
                ON CONFLICT (artifact_id, chunk_index) DO UPDATE SET
                    project_id = EXCLUDED.project_id,
                    artifact_type = EXCLUDED.artifact_type,
                    agent = EXCLUDED.agent,
                    title = EXCLUDED.title,
                    content_hash = EXCLUDED.content_hash,
                    search_text = EXCLUDED.search_text,
                    token_estimate = EXCLUDED.token_estimate,
                    embedding = COALESCE(EXCLUDED.embedding, artifact_memory_chunks.embedding),
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
                    vector_literal(embedding) if embedding else None,
                    Jsonb(metadata),
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
                       search_text, token_estimate, metadata, created_at,
                       NULL::double precision AS vector_score
                FROM artifact_memory_chunks
                WHERE project_id = %s
                ORDER BY created_at DESC, chunk_index ASC
                LIMIT %s
                """,
                (project_id, max_candidate_chunks()),
            ).fetchall()
            query_embedding = create_embedding(f"{phase_id}\n{query}")
            if query_embedding:
                query_vector = vector_literal(query_embedding)
                vector_rows = conn.execute(
                    """
                    SELECT id, artifact_id, chunk_index, artifact_type, agent, title,
                           search_text, token_estimate, metadata, created_at,
                           GREATEST(0, 1 - (embedding <=> %s::vector)) AS vector_score
                    FROM artifact_memory_chunks
                    WHERE project_id = %s
                      AND embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                    """,
                    (query_vector, project_id, query_vector, vector_candidate_chunks()),
                ).fetchall()
                rows = list(rows) + list(vector_rows)
    except Exception:
        return []

    candidates_by_id: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        memory_id = str(row[0])
        lexical_score = 0
        item = {
            "memory_id": memory_id,
            "artifact_id": str(row[1]),
            "chunk_index": int(row[2]),
            "artifact_type": row[3],
            "agent": row[4],
            "title": row[5],
            "search_text": row[6],
            "token_estimate": int(row[7] or 0),
            "metadata": row[8] or {},
            "created_at": row[9].isoformat() if hasattr(row[9], "isoformat") else str(row[9]),
            "vector_score": float(row[10] or 0),
        }
        lexical_score = score_chunk(item, terms, phase_id)
        if memory_id in candidates_by_id:
            existing = candidates_by_id[memory_id]
            existing["vector_score"] = max(existing.get("vector_score", 0), item["vector_score"])
            existing["lexical_score"] = max(existing.get("lexical_score", 0), lexical_score)
        else:
            item["lexical_score"] = lexical_score
            candidates_by_id[memory_id] = item

    candidates = list(candidates_by_id.values())
    max_lexical_score = max([item.get("lexical_score", 0) for item in candidates] or [1]) or 1
    alpha = hybrid_alpha()
    for item in candidates:
        lexical_norm = float(item.get("lexical_score", 0)) / max_lexical_score
        vector_score = float(item.get("vector_score", 0))
        item["score"] = round((alpha * vector_score) + ((1 - alpha) * lexical_norm), 4) if vector_score > 0 else round(lexical_norm, 4)

    ranked = sorted(candidates, key=lambda item: (item["score"], item.get("vector_score", 0), item["created_at"]), reverse=True)
    total_candidate_tokens = sum(int(item.get("token_estimate") or estimate_tokens(item.get("search_text", ""))) for item in candidates)
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
                "citation": f"artifact:{item['artifact_id']}#chunk:{item['chunk_index']}",
                "memory_id": item["memory_id"],
                "artifact_id": item["artifact_id"],
                "chunk": item["chunk_index"],
                "type": item["artifact_type"],
                "agent": item["agent"],
                "title": item["title"],
                "score": item["score"],
                "lexical_score": item.get("lexical_score", 0),
                "vector_score": round(float(item.get("vector_score", 0)), 4),
                "token_estimate": token_estimate,
                "candidate_token_estimate": total_candidate_tokens if not selected else 0,
                "summary": compact_text(item["search_text"], chunk_chars()),
                "uri": (item.get("metadata") or {}).get("uri"),
            }
        )
        seen.add(key)
        spent += token_estimate
        if spent >= max_tokens:
            break
    return selected
