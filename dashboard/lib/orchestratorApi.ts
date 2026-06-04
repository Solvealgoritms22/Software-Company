"use client";

export const apiBase = process.env.NEXT_PUBLIC_ORCHESTRATOR_URL || "http://localhost:8000";

export function orchestratorApiKey() {
  const envKey = process.env.NEXT_PUBLIC_ORCHESTRATOR_API_KEY || "";
  if (envKey) return envKey;
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem("orchestrator_api_key") || "";
}

export function withAuthHeaders(headers?: HeadersInit) {
  const nextHeaders = new Headers(headers);
  const key = orchestratorApiKey();
  if (key) {
    nextHeaders.set("X-API-Key", key);
  }
  return nextHeaders;
}

export function apiFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  return fetch(input, {
    ...init,
    headers: withAuthHeaders(init.headers),
  });
}

export function websocketUrl(projectId: string) {
  const url = new URL(apiBase);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = `/ws/projects/${projectId}`;
  const key = orchestratorApiKey();
  if (key) {
    url.searchParams.set("api_key", key);
  }
  return url.toString();
}
