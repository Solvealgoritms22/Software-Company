import sys
import os
import runpy
import uvicorn
from pathlib import Path

# When running in a PyInstaller bundle, sys._MEIPASS holds the path to the extracted files
if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
    base_dir = Path(sys._MEIPASS)
    orchestrator_dir = base_dir / "orchestrator"
    mcp_servers_dir = base_dir / "mcp_servers"
else:
    orchestrator_dir = Path(__file__).resolve().parent
    repo_root = orchestrator_dir.parent
    mcp_servers_dir = repo_root / "mcp_servers"

sys.path.insert(0, str(orchestrator_dir))
sys.path.insert(0, str(mcp_servers_dir))

# ---------------------------------------------------------------------------
# MULTIPROCESS ROUTER:
# If this binary is called with a path to an MCP server script,
# we route execution directly to that script. This allows mcp_pool.py
# to spawn stdio servers using the same frozen binary.
# ---------------------------------------------------------------------------
if len(sys.argv) > 1 and sys.argv[1].endswith('.py'):
    script_path = Path(sys.argv[1]).resolve()
    if script_path.exists():
        # Insert the script's parent dir to sys.path for local imports
        sys.path.insert(0, str(script_path.parent))
        # Execute the script as main so `if __name__ == "__main__":` triggers
        runpy.run_path(str(script_path), run_name="__main__")
        sys.exit(0)

# Import the orchestrator app
from main import app as orchestrator_app

if __name__ == "__main__":
    print("==================================================")
    print(" Starting DevFoundry Orchestrator API             ")
    print("==================================================")

    # Run the main orchestrator app on port 8000
    uvicorn.run(orchestrator_app, host="127.0.0.1", port=8000, log_level="info")
