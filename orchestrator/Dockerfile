FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY orchestrator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY orchestrator/*.py .
COPY orchestrator/routers ./routers
COPY mcp_servers ./mcp_servers
COPY agents/registry.yaml ./agents/registry.yaml
COPY knowledge_base/init.sql ./knowledge_base/init.sql
COPY config/mcp_catalog.json ./config/mcp_catalog.json

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
