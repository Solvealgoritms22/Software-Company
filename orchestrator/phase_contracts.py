import json
import os
from typing import Any, Dict, List, Tuple


def phase_contracts_enabled() -> bool:
    return os.getenv("PHASE_CONTRACTS_ENABLED", "true").lower() != "false"


def phase_contract_autofix_enabled() -> bool:
    return os.getenv("PHASE_CONTRACT_AUTOFIX", "true").lower() != "false"


def phase_schema_response_format_enabled() -> bool:
    return os.getenv("PHASE_CONTRACT_SCHEMA_RESPONSE_FORMAT", "true").lower() != "false"


def expected_deliverables(agent: Dict[str, Any]) -> List[str]:
    return [str(item).strip() for item in agent.get("deliverables", []) if str(item).strip()]


def build_phase_output_schema(agent_id: str, agent: Dict[str, Any]) -> Dict[str, Any]:
    deliverable_keys = expected_deliverables(agent)
    deliverable_properties = {
        key: {
            "type": "string",
            "description": f"Contenido completo y accionable para el entregable {key}.",
        }
        for key in deliverable_keys
    }
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["summary", "deliverables", "risks", "next_required_inputs", "citations"],
        "properties": {
            "summary": {
                "type": "string",
                "description": f"Resumen concreto en espanol de la fase ejecutada por {agent_id}.",
            },
            "deliverables": {
                "type": "object",
                "additionalProperties": False,
                "required": deliverable_keys,
                "properties": deliverable_properties,
            },
            "risks": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Riesgos, bloqueos o supuestos relevantes. Usa [] si no hay.",
            },
            "next_required_inputs": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Inputs requeridos por fases dependientes. Usa [] si no hay.",
            },
            "citations": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Citations RAG usadas desde existing_artifacts. Usa [] si no aplica.",
            },
        },
    }


def _stringify(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    try:
        return json.dumps(value, ensure_ascii=False, indent=2, default=str)
    except Exception:
        return str(value)


def _string_list(value: Any) -> List[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [item.strip() for item in (_stringify(item) for item in value) if item]
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    text = _stringify(value)
    return [text] if text else []


def normalize_phase_output(raw: Any, agent_id: str, agent: Dict[str, Any]) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    deliverable_keys = expected_deliverables(agent)
    allow_autofix = phase_contract_autofix_enabled()
    issues: List[str] = []
    corrections: List[str] = []
    if not isinstance(raw, dict):
        raw = {"summary": _stringify(raw), "deliverables": {}}
        issues.append("output_not_object")
        corrections.append("wrapped_non_object_output")

    deliverables_value = raw.get("deliverables")
    deliverables = deliverables_value if isinstance(deliverables_value, dict) else {}
    if not isinstance(deliverables_value, dict):
        issues.append("deliverables_not_object")
        corrections.append("created_deliverables_object")

    normalized_deliverables: Dict[str, str] = {}
    for key in deliverable_keys:
        value = deliverables.get(key)
        text = _stringify(value)
        if not text:
            issues.append(f"missing_deliverable:{key}")
            if allow_autofix:
                text = "Pendiente: el modelo no genero contenido para este entregable requerido."
                corrections.append(f"filled_missing_deliverable:{key}")
        normalized_deliverables[key] = text

    extra_keys = sorted(str(key) for key in deliverables.keys() if str(key) not in deliverable_keys)
    if extra_keys:
        issues.append("extra_deliverables_removed")
        corrections.append("removed_extra_deliverables")

    summary = _stringify(raw.get("summary"))
    if not summary:
        issues.append("missing_summary")
        if allow_autofix:
            summary = f"{agent_id} genero entregables para la fase, con normalizacion automatica de contrato."
            corrections.append("filled_summary")

    normalized = {
        "summary": summary,
        "deliverables": normalized_deliverables,
        "risks": _string_list(raw.get("risks")),
        "next_required_inputs": _string_list(raw.get("next_required_inputs")),
        "citations": _string_list(raw.get("citations")),
    }
    validation = validate_phase_output(normalized, agent_id, agent)
    validation.update(
        {
            "agent": agent_id,
            "expected_deliverables": deliverable_keys,
            "extra_deliverables": extra_keys,
            "issues": sorted(set(issues + validation.get("issues", []))),
            "corrections": corrections,
            "autofixed": bool(corrections),
        }
    )
    return normalized, validation


def validate_phase_output(output: Dict[str, Any], agent_id: str, agent: Dict[str, Any]) -> Dict[str, Any]:
    deliverable_keys = expected_deliverables(agent)
    issues: List[str] = []
    if not isinstance(output.get("summary"), str) or not output.get("summary", "").strip():
        issues.append("missing_summary")
    deliverables = output.get("deliverables")
    if not isinstance(deliverables, dict):
        issues.append("deliverables_not_object")
        deliverables = {}
    missing = [key for key in deliverable_keys if not str(deliverables.get(key) or "").strip()]
    if missing:
        issues.extend(f"missing_deliverable:{key}" for key in missing)
    extra = sorted(str(key) for key in deliverables.keys() if str(key) not in deliverable_keys)
    if extra:
        issues.append("extra_deliverables_present")
    for key in ("risks", "next_required_inputs", "citations"):
        if not isinstance(output.get(key), list):
            issues.append(f"{key}_not_array")
    return {
        "valid": not issues,
        "strict": True,
        "schema_name": "phase_output_contract",
        "agent": agent_id,
        "missing_deliverables": missing,
        "extra_deliverables": extra,
        "issues": issues,
    }
