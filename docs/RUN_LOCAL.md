# Run Local

## Prerequisites

- Docker Desktop running.
- WSL integration enabled for this distro if you run from WSL.
- `.env` created from `.env.example`.

```bash
cp .env.example .env
```

For a first visual run, you can leave most service keys empty and keep:

```env
LLM_STRICT=false
```

If `LLM_STRICT=false`, phases whose API keys are missing still generate placeholder artifacts so you can see the company workflow in the dashboard.

## Start

```bash
docker compose up --build
```

Open:

```text
Dashboard:    http://localhost:3000
Orchestrator: http://localhost:8000/docs
MCP status:   http://localhost:8000/mcp/status
GitHub MCP:   http://localhost:8010/docs
Jira MCP:     http://localhost:8011/docs
Confluence:   http://localhost:8012/docs
Google Drive: http://localhost:8013/docs
Deploy MCP:   http://localhost:8014/docs
Playwright:   http://localhost:8015/docs
Security:     http://localhost:8016/docs
```

## What is implemented now

- Visual dashboard.
- Orchestrator with ordered and parallel phases.
- Contract approval gate.
- PGlite knowledge database.
- GitHub MCP for repositories, branches, commits and pull requests.
- Jira MCP for issues, comments and transitions.
- Confluence MCP for Markdown/HTML pages.
- Google Drive MCP for text files and permissions.
- Deployment MCP for Vercel and Railway CLI.
- Playwright MCP for smoke tests and screenshots.
- Security MCP for Bandit, npm audit and ZAP API hooks.
- LLM calls through OpenAI or DeepSeek when keys are configured.

## Stop

```bash
docker compose down
```

To delete local PGlite data too:

```bash
docker compose down -v
```
