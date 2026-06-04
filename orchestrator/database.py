import os
import asyncio
import psycopg
from pathlib import Path
from typing import Optional

ROOT = Path(__file__).resolve().parent
APP_ROOT = ROOT if (ROOT / "config").exists() else ROOT.parent
KNOWLEDGE_SCHEMA_PATH = APP_ROOT / "knowledge_base" / "init.sql"

def db_dsn() -> str:
    parts = [
        f"host={os.getenv('KNOWLEDGE_DB_HOST', 'localhost')}",
        f"port={os.getenv('KNOWLEDGE_DB_PORT', '5432')}",
        f"dbname={os.getenv('KNOWLEDGE_DB_NAME', 'postgres')}",
        f"user={os.getenv('KNOWLEDGE_DB_USER', 'postgres')}",
        "sslmode=disable",
    ]
    password = os.getenv("KNOWLEDGE_DB_PASSWORD")
    if password:
        parts.append(f"password={password}")
    return " ".join(parts)

async def ensure_schema() -> None:
    if not KNOWLEDGE_SCHEMA_PATH.exists():
        return
    schema_sql = KNOWLEDGE_SCHEMA_PATH.read_text(encoding="utf-8")
    last_error: Optional[Exception] = None
    for _ in range(20):
        try:
            with psycopg.connect(db_dsn(), autocommit=True) as conn:
                conn.execute(schema_sql)
            return
        except Exception as exc:
            last_error = exc
            await asyncio.sleep(1)
    raise RuntimeError(f"Knowledge DB schema initialization failed: {last_error}") from last_error
