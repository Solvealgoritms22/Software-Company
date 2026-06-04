import os
from typing import Dict, List, Optional
import json

from github import Github, GithubException, InputGitAuthor
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("github", dependencies=["PyGithub"])

class GitHubMCP:
    def __init__(self) -> None:
        self.token = os.getenv("GITHUB_PERSONAL_ACCESS_TOKEN") or os.getenv("GITHUB_TOKEN", "")
        self.bot_username = os.getenv("GITHUB_BOT_USERNAME", "software-factory-bot")
        self.bot_email = os.getenv("GITHUB_BOT_EMAIL", "agents@software-factory.local")
        self.client = Github(self.token) if self.token else None

    def require_client(self) -> Github:
        if not self.client:
            raise ValueError("GITHUB_TOKEN is not configured")
        return self.client

    @staticmethod
    def agent_email(agent_name: str) -> str:
        slug = agent_name.lower().replace("_", "-").replace(" ", "-")
        allowed = "".join(ch for ch in slug if ch.isalnum() or ch == "-")
        return f"{allowed}@agents.software-factory.local"

github_mcp = GitHubMCP()

@mcp.tool()
def github_create_repo(name: str, description: str = "", private: bool = False) -> str:
    """Crea un nuevo repositorio en GitHub para el proyecto."""
    try:
        client = github_mcp.require_client()
        repo = client.get_user().create_repo(
            name,
            description=description,
            private=private,
            auto_init=True,
        )
        return json.dumps({"full_name": repo.full_name, "clone_url": repo.clone_url, "html_url": repo.html_url})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
def github_create_branch(repo_full_name: str, new_branch: str, base_branch: str = "main") -> str:
    """Crea una nueva rama de git a partir de una rama base."""
    try:
        repo = github_mcp.require_client().get_repo(repo_full_name)
        try:
            existing = repo.get_branch(new_branch)
            return json.dumps({"branch": new_branch, "sha": existing.commit.sha, "status": "exists"})
        except GithubException:
            pass
        base = repo.get_branch(base_branch)
        ref = repo.create_git_ref(ref=f"refs/heads/{new_branch}", sha=base.commit.sha)
        return json.dumps({"branch": new_branch, "sha": ref.object.sha, "status": "created"})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
def github_commit_files(repo_full_name: str, branch: str, message: str, file_contents: str, agent_name: str = "agent") -> str:
    """Crea commits con múltiples archivos a la vez en una rama específica de GitHub. file_contents es un json map str->str"""
    try:
        repo = github_mcp.require_client().get_repo(repo_full_name)
        author = InputGitAuthor(agent_name, github_mcp.agent_email(agent_name))
        committer = InputGitAuthor(github_mcp.bot_username, github_mcp.bot_email)
        commit_message = f"[{agent_name}] {message}"
        commits: List[Dict[str, str]] = []
        
        parsed_contents = json.loads(file_contents) if isinstance(file_contents, str) else file_contents

        for path, content in parsed_contents.items():
            try:
                current = repo.get_contents(path, ref=branch)
                result = repo.update_file(
                    path=path,
                    message=commit_message,
                    content=content,
                    sha=current.sha,
                    branch=branch,
                    author=author,
                    committer=committer,
                )
                status = "updated"
            except GithubException as exc:
                if exc.status != 404:
                    raise
                result = repo.create_file(
                    path=path,
                    message=commit_message,
                    content=content,
                    branch=branch,
                    author=author,
                    committer=committer,
                )
                status = "created"
            commits.append({"path": path, "sha": result["commit"].sha, "status": status})

        return json.dumps({"repo_full_name": repo_full_name, "branch": branch, "commits": commits})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
def github_create_pull_request(repo_full_name: str, head_branch: str, title: str, base_branch: str = "main", body: str = "") -> str:
    """Crea un pull request de una rama origen a una rama destino."""
    try:
        repo = github_mcp.require_client().get_repo(repo_full_name)
        pull = repo.create_pull(
            title=title,
            body=body,
            head=head_branch,
            base=base_branch,
        )
        return json.dumps({"number": str(pull.number), "html_url": pull.html_url, "state": pull.state})
    except Exception as exc:
        return json.dumps({"error": str(exc)})

@mcp.tool()
def github_read_file(repo_full_name: str, path: str, ref: str = "main") -> str:
    """Lee el contenido de un archivo desde un repositorio de GitHub."""
    try:
        repo = github_mcp.require_client().get_repo(repo_full_name)
        try:
            content = repo.get_contents(path, ref=ref)
            return json.dumps({
                "path": path,
                "sha": content.sha,
                "content": content.decoded_content.decode("utf-8"),
            })
        except GithubException as exc:
            if exc.status == 404:
                return json.dumps({"path": path, "sha": None, "content": None})
            raise
    except Exception as exc:
        return json.dumps({"error": str(exc)})

app = mcp.sse_app()

if __name__ == '__main__':
    mcp.run()

