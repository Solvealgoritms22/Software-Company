import asyncio
import json
import os
import pathlib
import sys
import time
from contextlib import AsyncExitStack
from dataclasses import dataclass
from typing import Any, Dict, Optional


@dataclass
class McpToolRequest:
    name: str
    arguments: Dict[str, Any]
    future: asyncio.Future[str]


@dataclass
class McpServerWorker:
    server_dir: str
    queue: asyncio.Queue[Optional[McpToolRequest]]
    ready: asyncio.Future[bool]
    task: asyncio.Task[None]
    created_at: float
    last_used_at: float
    uses: int = 0
    closed: bool = False


def _int_env(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
        return value if value > 0 else default
    except Exception:
        return default


def _server_script(server_dir: str) -> pathlib.Path:
    app_root = pathlib.Path(__file__).parent.resolve()
    candidates = [
        app_root / "mcp_servers" / server_dir / "server.py",
        app_root.parent / "mcp_servers" / server_dir / "server.py",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[-1]


def _extract_text(result: Any) -> str:
    content = getattr(result, "content", None) or []
    parts = []
    for item in content:
        text = getattr(item, "text", None)
        if text is not None:
            parts.append(text)
        elif hasattr(item, "model_dump"):
            parts.append(json.dumps(item.model_dump(), ensure_ascii=False))
        else:
            parts.append(str(item))
    if parts:
        return "\n".join(parts)
    if hasattr(result, "model_dump"):
        return json.dumps(result.model_dump(), ensure_ascii=False)
    return str(result)


class McpSessionPool:
    def __init__(self) -> None:
        self._workers: Dict[str, McpServerWorker] = {}
        self._pool_lock = asyncio.Lock()

    @property
    def idle_seconds(self) -> int:
        return _int_env("MCP_SESSION_IDLE_SECONDS", 300)

    @property
    def max_uses(self) -> int:
        return _int_env("MCP_SESSION_MAX_USES", 100)

    @property
    def call_timeout_seconds(self) -> int:
        return _int_env("MCP_TOOL_CALL_TIMEOUT_SECONDS", 300)

    def _is_expired(self, worker: McpServerWorker) -> bool:
        if worker.closed or worker.task.done():
            return True
        if worker.uses >= self.max_uses:
            return True
        return (time.monotonic() - worker.last_used_at) > self.idle_seconds

    async def _run_worker(self, server_dir: str, queue: asyncio.Queue[Optional[McpToolRequest]], ready: asyncio.Future[bool]) -> None:
        from mcp import ClientSession, StdioServerParameters
        from mcp.client.stdio import stdio_client

        stack = AsyncExitStack()
        try:
            script_path = _server_script(server_dir)
            if not script_path.exists():
                raise FileNotFoundError(f"MCP server script not found: {script_path}")

            env = os.environ.copy()
            env.setdefault("PYTHONUNBUFFERED", "1")

            server_params = StdioServerParameters(
                command=sys.executable,
                args=[str(script_path)],
                env=env,
            )
            read, write = await stack.enter_async_context(stdio_client(server_params))
            session = await stack.enter_async_context(ClientSession(read, write))
            await session.initialize()
            if not ready.done():
                ready.set_result(True)

            while True:
                request = await queue.get()
                if request is None:
                    return
                try:
                    result = await session.call_tool(request.name, arguments=request.arguments)
                    if not request.future.done():
                        request.future.set_result(_extract_text(result))
                except Exception as exc:
                    if not request.future.done():
                        request.future.set_exception(exc)
        except Exception as exc:
            if not ready.done():
                ready.set_exception(exc)
            while True:
                try:
                    request = queue.get_nowait()
                except asyncio.QueueEmpty:
                    break
                if request and not request.future.done():
                    request.future.set_exception(exc)
            raise
        finally:
            await stack.aclose()

    async def _create_worker(self, server_dir: str) -> McpServerWorker:
        now = time.monotonic()
        loop = asyncio.get_running_loop()
        queue: asyncio.Queue[Optional[McpToolRequest]] = asyncio.Queue()
        ready = loop.create_future()
        task = asyncio.create_task(self._run_worker(server_dir, queue, ready))
        worker = McpServerWorker(
            server_dir=server_dir,
            queue=queue,
            ready=ready,
            task=task,
            created_at=now,
            last_used_at=now,
        )
        try:
            await ready
        except Exception:
            worker.closed = True
            if not task.done():
                task.cancel()
            try:
                await task
            except BaseException:
                pass
            raise
        return worker

    async def _get_worker(self, server_dir: str) -> McpServerWorker:
        async with self._pool_lock:
            worker = self._workers.get(server_dir)
            if worker and self._is_expired(worker):
                await self._close_worker(server_dir, worker)
                worker = None
            if not worker:
                worker = await self._create_worker(server_dir)
                self._workers[server_dir] = worker
            return worker

    async def _close_worker(self, server_dir: str, worker: Optional[McpServerWorker] = None) -> None:
        worker = worker or self._workers.get(server_dir)
        if not worker or worker.closed:
            return
        worker.closed = True
        self._workers.pop(server_dir, None)
        try:
            worker.queue.put_nowait(None)
            await asyncio.wait_for(worker.task, timeout=5)
        except Exception:
            worker.task.cancel()
            try:
                await worker.task
            except BaseException:
                pass

    async def call_tool(self, server_dir: str, name: str, arguments: Dict[str, Any]) -> str:
        worker = await self._get_worker(server_dir)
        loop = asyncio.get_running_loop()
        future: asyncio.Future[str] = loop.create_future()
        await worker.queue.put(McpToolRequest(name=name, arguments=arguments, future=future))
        try:
            result = await asyncio.wait_for(future, timeout=self.call_timeout_seconds)
            worker.uses += 1
            worker.last_used_at = time.monotonic()
            return result
        except Exception:
            async with self._pool_lock:
                await self._close_worker(server_dir, worker)
            raise

    async def close_all(self) -> None:
        async with self._pool_lock:
            workers = list(self._workers.items())
            for server_dir, worker in workers:
                await self._close_worker(server_dir, worker)


_POOL = McpSessionPool()


async def call_stdio_tool(server_dir: str, name: str, arguments: Dict[str, Any]) -> str:
    return await _POOL.call_tool(server_dir, name, arguments)


async def close_mcp_pool() -> None:
    await _POOL.close_all()
