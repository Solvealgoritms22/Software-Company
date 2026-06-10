import json
from typing import Dict

import psycopg

from artifact_memory import reindex_project_memory
from database import db_dsn
from models import ProjectState
from project_config import build_initial_phases


def persist_project_state(project: ProjectState) -> None:
    import time
    state_dump = project.model_dump_json()
    for attempt in range(5):
        try:
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
                    (
                        project.id,
                        project.name,
                        project.client_goal,
                        project.budget,
                        project.status,
                        project.current_phase,
                        state_dump,
                    ),
                )
            return
        except Exception as exc:
            if attempt == 4:
                raise RuntimeError(f"Failed to persist project state after 5 attempts: {exc}") from exc
            time.sleep(1)


def load_projects_into(projects: Dict[str, ProjectState]) -> None:
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
                            state = ProjectState.model_validate(state_dump if isinstance(state_dump, dict) else json.loads(state_dump))
                        except Exception as exc:
                            print(f"Error validating state_dump for project {row_id}: {exc}")

                    if not state:
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
                        except Exception as exc:
                            print(f"Failed to reconstruct project {row_id}: {exc}")

                    if state:
                        projects[state.id] = state
                        reindex_project_memory(state.id, state.artifacts)
    except Exception as exc:
        print(f"Failed to load projects from DB: {exc}")

    for state in to_persist:
        try:
            persist_project_state(state)
            print(f"Successfully persisted reconstructed project {state.id} ({state.name})")
        except Exception as exc:
            print(f"Failed to persist reconstructed project {state.id}: {exc}")
