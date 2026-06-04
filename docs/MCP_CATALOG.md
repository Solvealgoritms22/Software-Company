# MCP Catalog

The company uses a central MCP catalog at `config/mcp_catalog.json`.

You can manage the catalog from the dashboard:

```text
http://localhost:3000
```

Open the `MCPs` view to:

- Enable or disable MCP servers.
- Add marketplace MCPs manually.
- See which agents use each MCP.
- Export stdio MCP configuration for Codex, VS Code, Cursor or Claude.

## UI and Frontend MCPs

### shadcn/ui MCP

Used by:

- Frontend Architect Agent
- Frontend Developer Agent

Default stdio command:

```json
{
  "command": "npx",
  "args": ["shadcn@latest", "mcp"]
}
```

The shadcn MCP lets agents browse, search and install components from shadcn-compatible registries. shadcn documents that registries are configured in `components.json` and that Codex requires manual MCP configuration.

Source: https://ui.shadcn.com/docs/mcp

### Context7 MCP

Used by:

- Frontend Architect Agent
- Frontend Developer Agent
- Software Architect Agent
- Backend Developer Agent

Default stdio command:

```json
{
  "command": "npx",
  "args": ["-y", "@upstash/context7-mcp@latest"]
}
```

Context7 provides up-to-date library documentation and examples. Once UI recommends Context7 MCP for agents and shows `/once-ui-system/core` as a library ID.

Sources:

- https://context7.com/docs
- https://docs.once-ui.com/vibe-coding

## Marketplace MCPs

Use LobeHub MCP Marketplace as a discovery source, then add only trusted MCPs into the dashboard catalog. Do not bulk-install unknown MCPs. Add them one by one with:

- Name
- Command
- Args
- Required env keys
- Agents allowed to use it
- Docs URL

Source: https://lobehub.com/mcp

## Security Rule

Marketplace MCPs can execute local commands or access external services. Keep risky MCPs disabled until reviewed, especially filesystem, browser automation and fetch tools.
