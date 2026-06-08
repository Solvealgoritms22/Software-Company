from typing import Any, Dict, List


VALID_PHASE_STATUSES = {"pending", "running", "completed", "failed"}


def assert_phase_graph_valid(
    phases: Dict[str, Dict[str, Any]],
    agents: Dict[str, Any],
    max_phases: int,
) -> None:
    if len(phases) > max_phases:
        raise RuntimeError(f"Project phase limit exceeded: {len(phases)} > {max_phases}")

    visiting: set[str] = set()
    visited: set[str] = set()

    for phase_id, phase in phases.items():
        if not isinstance(phase, dict):
            raise RuntimeError(f"Phase '{phase_id}' must be an object")
        if phase.get("id") and phase.get("id") != phase_id:
            raise RuntimeError(f"Phase key/id mismatch: '{phase_id}' != '{phase.get('id')}'")
        if phase.get("agent") not in agents:
            raise RuntimeError(f"Phase '{phase_id}' references missing agent '{phase.get('agent')}'")
        if phase.get("status") not in VALID_PHASE_STATUSES:
            raise RuntimeError(f"Phase '{phase_id}' has invalid status '{phase.get('status')}'")
        depends_on = phase.get("depends_on", [])
        if not isinstance(depends_on, list):
            raise RuntimeError(f"Phase '{phase_id}' depends_on must be a list")
        for dep in depends_on:
            if dep == phase_id:
                raise RuntimeError(f"Phase '{phase_id}' cannot depend on itself")
            if dep not in phases:
                raise RuntimeError(f"Phase '{phase_id}' depends on missing phase '{dep}'")

    def visit(phase_id: str, chain: List[str]) -> None:
        if phase_id in visited:
            return
        if phase_id in visiting:
            raise RuntimeError(f"Project phase dependency cycle detected: {' -> '.join(chain + [phase_id])}")
        visiting.add(phase_id)
        for dep in phases[phase_id].get("depends_on", []):
            visit(dep, chain + [phase_id])
        visiting.remove(phase_id)
        visited.add(phase_id)

    for phase_id in phases:
        visit(phase_id, [])
