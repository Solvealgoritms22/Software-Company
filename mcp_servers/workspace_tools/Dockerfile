FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip git ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 8017
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8017"]
