from registry_validation import (
    validate_agent_registry,
    validate_departments,
    validate_mcp_catalog,
    validate_runtime_configuration,
)


def test_department_cycle_is_error() -> None:
    report = validate_departments(
        {
            "departments": {
                "engineering": {"title": "Engineering", "parent_id": "product"},
                "product": {"title": "Product", "parent_id": "engineering"},
            }
        }
    )

    assert not report.valid
    assert any("cycle" in error for error in report.errors)


def test_agent_missing_department_is_error() -> None:
    registry = {
        "agents": {
            "ceo": {"name": "CEO", "department_id": "missing", "tools": []},
        },
        "skills": [],
        "deliverables": [],
    }

    report = validate_agent_registry(registry, {"departments": {}}, {"servers": {}})

    assert not report.valid
    assert any("missing department" in error for error in report.errors)


def test_mcp_missing_required_agent_is_warning_not_error() -> None:
    report = validate_mcp_catalog(
        {
            "servers": {
                "future_mcp": {
                    "enabled": True,
                    "kind": "stdio",
                    "command": "npx",
                    "required_for": ["future_agent"],
                }
            }
        },
        {"agents": {"ceo": {"name": "CEO"}}},
    )

    assert report.valid
    assert any("future_agent" in warning for warning in report.warnings)


def test_runtime_configuration_combines_reports() -> None:
    report = validate_runtime_configuration(
        {"agents": {"ceo": {"name": "CEO", "tools": ["unknown_tool"]}}},
        {"departments": {}},
        {"servers": {}},
    )

    assert report.valid
    assert any("unknown_tool" in warning for warning in report.warnings)
