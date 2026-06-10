import sys
import importlib.util
from pathlib import Path

script_path = Path(sys.argv[1]).resolve()
mcp_name = script_path.parent.name
module_name = f"mcp_{mcp_name}_server"

spec = importlib.util.spec_from_file_location(module_name, str(script_path))
module = importlib.util.module_from_spec(spec)
sys.modules[module_name] = module
spec.loader.exec_module(module)

print("Module loaded successfully.")
if hasattr(module, "mcp"):
    print("Found mcp instance.")
    # module.mcp.run() # We don't want to actually run it and block here
