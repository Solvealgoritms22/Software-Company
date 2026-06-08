import os
from typing import Any, Dict


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


def positive_int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
        return value if value > 0 else default
    except Exception:
        return default


def max_project_phases() -> int:
    return positive_int_env("MAX_PROJECT_PHASES", 64)


def max_dynamic_phases_per_output() -> int:
    return positive_int_env("MAX_DYNAMIC_PHASES_PER_OUTPUT", 5)


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
