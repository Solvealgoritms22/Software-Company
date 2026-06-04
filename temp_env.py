import os, re
for root, _, files in os.walk('mcp_servers'):
    for f in files:
        if f.endswith('.py'):
            content = open(os.path.join(root, f), 'r', encoding='utf-8').read()
            envs = set(re.findall(r'(?:os\.getenv|os\.environ\.get|os\.environ\[)[\'"]([A-Z_0-9]+)[\'"]', content))
            if envs:
                print(f"{root}/{f}: {envs}")
