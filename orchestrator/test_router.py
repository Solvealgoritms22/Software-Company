import sys
import runpy

if len(sys.argv) > 1 and sys.argv[1].endswith('.py'):
    print(f"Routing to: {sys.argv[1]}")
    runpy.run_path(sys.argv[1], run_name='__main__')
else:
    print("Running orchestrator")
