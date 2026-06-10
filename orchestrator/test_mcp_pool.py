import asyncio
import os
import sys
from pathlib import Path

app_root = Path(__file__).resolve().parent
sys.path.insert(0, str(app_root))

from mcp_pool import call_stdio_tool

async def test_tool():
    print("Requesting github tool...")
    # Passing sys.executable which inside our test is just python.exe
    # Our run_backend.py router handles .py scripts when called.
    # Wait, call_stdio_tool calls sys.executable! So if we run it via python.exe, it calls python.exe mcp_servers/.../server.py.
    # But python.exe doesn't have the router! It just executes the script directly.
    # To test the ROUTER, we must set sys.executable to 'python run_backend.py' which isn't possible directly.
    # Actually, if we run mcp_servers/github/server.py directly with python.exe, it works natively anyway because it has if __name__ == '__main__': mcp.run().
    # Our router is specifically for the frozen PyInstaller executable where sys.executable is devfoundry-backend.exe!
    
    print("Testing direct execution of server.py via stdio...")
    result = await call_stdio_tool("github", "github_read_file", {
        "repo_full_name": "dfajardo/Software-Company",
        "path": "README.md"
    })
    print("Result:", result[:100] if result else "No result")

asyncio.run(test_tool())
