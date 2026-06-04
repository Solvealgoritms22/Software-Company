# Credentials Setup

Copy `.env.example` to `.env` and place real credentials only in `.env`.

```bash
cp .env.example .env
```

Never commit `.env`. It is already listed in `.gitignore`.

## GitHub

Recommended initial setup: create a separate GitHub bot account or use your account while testing.

1. Go to `https://github.com/settings/tokens`.
2. Open `Tokens (classic)`.
3. Select `Generate new token (classic)`.
4. Name: `software-company-ai-factory`.
5. Expiration: choose a reasonable expiration.
6. Scopes for the current MCP:
   - `repo`
   - `workflow`
7. Copy the token once and place it in `.env`.

```env
GITHUB_TOKEN=ghp_your_token
GITHUB_BOT_USERNAME=your-github-bot-username
GITHUB_BOT_EMAIL=agents@your-domain.com
```

For stricter production security, migrate later to a GitHub App or fine-grained token.

## Jira Cloud

The current setup uses direct Jira site URL plus email and API token.

1. Go to `https://id.atlassian.com/manage-profile/security/api-tokens`.
2. Select `Create API token`.
3. Name: `software-company-ai-factory`.
4. Set an expiration date.
5. Copy the token once and place it in `.env`.

Use only the base Jira URL, without query parameters:

```env
JIRA_URL=https://your-company.atlassian.net
JIRA_USER=your-atlassian-email@example.com
JIRA_API_TOKEN=your_api_token
JIRA_PROJECT_KEY=SF
```

`JIRA_PROJECT_KEY` is the short project key visible in issue IDs like `SF-1`.
