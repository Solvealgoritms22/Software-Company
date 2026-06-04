import json
import os
import re
from hashlib import sha256
from typing import Any, Dict, Iterable, List, Optional


DEFAULT_MAX_INPUT_TOKENS = 12_000
DEFAULT_MAX_OUTPUT_TOKENS = 2_000
DEFAULT_MAX_TOOL_TURNS = 6
DEFAULT_MAX_TOOL_OUTPUT_CHARS = 4_000
DEFAULT_ARTIFACT_CONTEXT_TOKENS = 5_000


MODEL_PRICES_PER_1K = {
    "gpt-4.1-mini": {"input": 0.0004, "cached_input": 0.0001, "output": 0.0016},
    "gpt-4o-mini": {"input": 0.00015, "cached_input": 0.000075, "output": 0.0006},
    "gpt-4o": {"input": 0.0025, "cached_input": 0.00125, "output": 0.01},
    "deepseek-chat": {"input": 0.00027, "cached_input": 0.00007, "output": 0.0011},
    "deepseek-reasoner": {"input": 0.00055, "cached_input": 0.00014, "output": 0.0022},
}


def int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, "").strip())
        return value if value > 0 else default
    except Exception:
        return default


def float_env(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, "").strip())
        return value if value > 0 else default
    except Exception:
        return default


def estimate_tokens(value: Any) -> int:
    if value is None:
        return 0
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=True, default=str)
    # English/Spanish prose plus JSON averages around 3-5 chars/token. Use 4 as a practical guard.
    return max(1, len(value) // 4)


def stable_hash(value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=True, sort_keys=True, default=str)
    return sha256(raw.encode("utf-8")).hexdigest()


def compact_text(value: Any, max_chars: int) -> str:
    if value is None:
        return ""
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=True, default=str)
    value = redact_secrets(value)
    value = re.sub(r"\s+", " ", value).strip()
    if len(value) <= max_chars:
        return value
    head = max_chars // 2
    tail = max_chars - head - 80
    return f"{value[:head]} ... [truncated {len(value) - max_chars} chars] ... {value[-max(0, tail):]}"


def redact_secrets(value: Any) -> str:
    text = value if isinstance(value, str) else json.dumps(value, ensure_ascii=True, default=str)
    patterns = [
        r"sk-[A-Za-z0-9_\-]{12,}",
        r"sk-proj-[A-Za-z0-9_\-]{12,}",
        r"ctx7sk-[A-Za-z0-9_\-]{12,}",
        r"ghp_[A-Za-z0-9_]{20,}",
        r"github_pat_[A-Za-z0-9_]{20,}",
        r"AIza[A-Za-z0-9_\-]{20,}",
        r"(?i)(api[_-]?key|token|secret|password)(['\"\s:=]+)([^,'\"\s}]{8,})",
    ]
    for pattern in patterns:
        if pattern.startswith("(?i)"):
            text = re.sub(pattern, r"\1\2[REDACTED]", text)
        else:
            text = re.sub(pattern, "[REDACTED]", text)
    return text


def artifact_search_text(artifact: Dict[str, Any]) -> str:
    parts = [
        artifact.get("type", ""),
        artifact.get("agent", ""),
        artifact.get("title", ""),
        artifact.get("content", {}),
    ]
    return compact_text(parts, 20_000).lower()


def score_artifact(artifact: Dict[str, Any], query_terms: Iterable[str]) -> int:
    text = artifact_search_text(artifact)
    score = 0
    for term in query_terms:
        if len(term) < 3:
            continue
        score += text.count(term)
    phase_type = str(artifact.get("type", ""))
    if phase_type in {"architecture", "analysis", "senior_backend", "frontend_architecture", "database"}:
        score += 2
    return score


def select_relevant_artifacts(
    phase_id: str,
    client_goal: str,
    artifacts: List[Dict[str, Any]],
    max_tokens: Optional[int] = None,
) -> List[Dict[str, Any]]:
    if not artifacts:
        return []

    max_tokens = max_tokens or int_env("MAX_ARTIFACT_CONTEXT_TOKENS", DEFAULT_ARTIFACT_CONTEXT_TOKENS)
    query_terms = re.findall(r"[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9_]+", f"{phase_id} {client_goal}".lower())
    ranked = sorted(
        artifacts,
        key=lambda artifact: (score_artifact(artifact, query_terms), artifact.get("created_at", "")),
        reverse=True,
    )

    selected: List[Dict[str, Any]] = []
    spent = 0
    per_artifact_chars = int_env("MAX_ARTIFACT_CONTEXT_CHARS", 1_800)
    for artifact in ranked:
        compact = {
            "id": artifact.get("id"),
            "type": artifact.get("type"),
            "agent": artifact.get("agent"),
            "title": artifact.get("title"),
            "summary": compact_text(artifact.get("content", {}), per_artifact_chars),
            "uri": artifact.get("uri"),
        }
        tokens = estimate_tokens(compact)
        if selected and spent + tokens > max_tokens:
            continue
        selected.append(compact)
        spent += tokens
        if spent >= max_tokens:
            break
    return selected


def usage_dict(response_usage: Any) -> Dict[str, int]:
    if not response_usage:
        return {}
    raw = response_usage.model_dump() if hasattr(response_usage, "model_dump") else dict(response_usage)
    prompt_tokens = int(raw.get("prompt_tokens") or raw.get("input_tokens") or 0)
    completion_tokens = int(raw.get("completion_tokens") or raw.get("output_tokens") or 0)
    details = raw.get("prompt_tokens_details") or raw.get("input_tokens_details") or {}
    cached_tokens = int(details.get("cached_tokens") or 0) if isinstance(details, dict) else 0
    return {
        **raw,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "cached_tokens": cached_tokens,
    }


def estimate_cost_usd(model: str, usage: Dict[str, Any]) -> float:
    prices = MODEL_PRICES_PER_1K.get(model, MODEL_PRICES_PER_1K.get(model.split(":")[-1], {}))
    if not prices:
        return 0.0
    prompt_tokens = int(usage.get("prompt_tokens") or 0)
    completion_tokens = int(usage.get("completion_tokens") or 0)
    cached_tokens = int(usage.get("cached_tokens") or 0)
    uncached_tokens = max(0, prompt_tokens - cached_tokens)
    cost = (
        (uncached_tokens / 1000) * prices["input"]
        + (cached_tokens / 1000) * prices.get("cached_input", prices["input"])
        + (completion_tokens / 1000) * prices["output"]
    )
    return round(cost, 6)


def assert_within_prompt_budget(messages: List[Dict[str, str]], model: str) -> Dict[str, Any]:
    estimated_input_tokens = estimate_tokens(messages)
    max_input_tokens = int_env("MAX_INPUT_TOKENS_PER_PHASE", DEFAULT_MAX_INPUT_TOKENS)
    if estimated_input_tokens > max_input_tokens:
        raise RuntimeError(
            f"Estimated prompt size {estimated_input_tokens} tokens exceeds MAX_INPUT_TOKENS_PER_PHASE={max_input_tokens} for {model}."
        )
    return {
        "estimated_input_tokens": estimated_input_tokens,
        "max_input_tokens": max_input_tokens,
        "prompt_hash": stable_hash(messages),
    }


def max_output_tokens() -> int:
    return int_env("MAX_OUTPUT_TOKENS_PER_PHASE", DEFAULT_MAX_OUTPUT_TOKENS)


def max_tool_turns() -> int:
    return int_env("MAX_TOOL_TURNS_PER_PHASE", DEFAULT_MAX_TOOL_TURNS)


def max_tool_output_chars() -> int:
    return int_env("MAX_TOOL_OUTPUT_CHARS", DEFAULT_MAX_TOOL_OUTPUT_CHARS)


def project_cost_limit() -> float:
    return float_env("MAX_PROJECT_COST_USD", 0.0)
