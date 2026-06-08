from project_graph import assert_phase_graph_valid


def test_project_graph_rejects_missing_dependency() -> None:
    phases = (
        {
            "ceo": {
                "id": "ceo",
                "agent": "ceo",
                "depends_on": ["missing"],
                "status": "pending",
            }
        }
    )

    try:
        assert_phase_graph_valid(phases, {"ceo": {}}, 64)
    except RuntimeError as exc:
        assert "missing phase" in str(exc)
    else:
        raise AssertionError("expected missing dependency to fail")


def test_project_graph_rejects_dependency_cycle() -> None:
    phases = (
        {
            "a": {"id": "a", "agent": "ceo", "depends_on": ["b"], "status": "pending"},
            "b": {"id": "b", "agent": "ceo", "depends_on": ["a"], "status": "pending"},
        }
    )

    try:
        assert_phase_graph_valid(phases, {"ceo": {}}, 64)
    except RuntimeError as exc:
        assert "cycle" in str(exc)
    else:
        raise AssertionError("expected dependency cycle to fail")
