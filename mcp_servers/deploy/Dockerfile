FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip git ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g vercel @railway/cli

COPY requirements.txt .
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

COPY server.py .

EXPOSE 8014
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8014"]
