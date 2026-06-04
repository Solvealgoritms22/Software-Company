import asyncio
import json

from tools_dispatcher import ToolDispatcher


async def _dispatch_contract() -> None:
    result = await ToolDispatcher.dispatch(
        "github_create_repo",
        {"name": "contract-test-repo", "description": "contract test"},
        agent_name="agent_without_tools",
    )
    payload = json.loads(result)
    assert "not allowed" in payload["error"]


def test_dispatch() -> None:
    asyncio.run(_dispatch_contract())

if __name__ == "__main__":
    asyncio.run(_dispatch_contract())
