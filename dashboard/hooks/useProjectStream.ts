"use client";

import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from "react";

import { apiBase, apiFetch, websocketUrl } from "../lib/orchestratorApi";
import type { AgentTrace, ProjectState, ProjectUsageSummary, ToolApproval } from "./orchestratorTypes";

type UseProjectStreamInput = {
  projectId?: string;
  setProject: Dispatch<SetStateAction<ProjectState | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshProjectTraces: (projectId: string) => Promise<void>;
  refreshProjectUsage: (projectId: string) => Promise<void>;
  refreshToolApprovals: (projectId: string) => Promise<void>;
};

type SideRefresh = {
  traces?: AgentTrace[];
  usage?: ProjectUsageSummary;
  approvals?: ToolApproval[];
};

export function useProjectStream({
  projectId,
  setProject,
  setError,
  refreshProjectTraces,
  refreshProjectUsage,
  refreshToolApprovals,
}: UseProjectStreamInput) {
  const [streamBuffers, setStreamBuffers] = useState<Record<string, string>>({});
  const pendingStreamTokens = useRef<Record<string, string>>({});
  const streamFlushFrame = useRef<number | null>(null);
  const sideRefreshTimer = useRef<number | null>(null);
  const sideRefreshProjectId = useRef<string | null>(null);

  const refreshSideData = useCallback(async (id: string): Promise<SideRefresh> => {
    await Promise.all([
      refreshProjectTraces(id),
      refreshProjectUsage(id),
      refreshToolApprovals(id),
    ]);
    return {};
  }, [refreshProjectTraces, refreshProjectUsage, refreshToolApprovals]);

  const flushStreamTokens = useCallback(() => {
    streamFlushFrame.current = null;
    const pending = pendingStreamTokens.current;
    pendingStreamTokens.current = {};
    if (Object.keys(pending).length === 0) return;
    setStreamBuffers((prev) => {
      const next = { ...prev };
      for (const [phase, chunk] of Object.entries(pending)) {
        next[phase] = (next[phase] || "") + chunk;
      }
      return next;
    });
  }, []);

  const enqueueStreamToken = useCallback((phase: string, token: string) => {
    pendingStreamTokens.current[phase] = (pendingStreamTokens.current[phase] || "") + token;
    if (streamFlushFrame.current !== null) return;
    streamFlushFrame.current = window.requestAnimationFrame(flushStreamTokens);
  }, [flushStreamTokens]);

  const scheduleProjectSideRefresh = useCallback((id: string) => {
    sideRefreshProjectId.current = id;
    if (sideRefreshTimer.current !== null) return;
    sideRefreshTimer.current = window.setTimeout(() => {
      sideRefreshTimer.current = null;
      const pendingId = sideRefreshProjectId.current;
      if (!pendingId) return;
      void refreshSideData(pendingId);
    }, 500);
  }, [refreshSideData]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    async function fetchProject() {
      try {
        const res = await apiFetch(`${apiBase}/projects/${projectId}`);
        if (!res.ok) throw new Error("Failed to load project");
        const data = await res.json();
        if (cancelled) return;
        setProject(data);
        await refreshSideData(data.id);
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      }
    }
    void fetchProject();
    return () => {
      cancelled = true;
    };
  }, [projectId, refreshSideData, setError, setProject]);

  useEffect(() => {
    if (!projectId) return;
    const ws = new WebSocket(websocketUrl(projectId));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "token") {
          enqueueStreamToken(data.phase, data.token);
        } else if (data.type === "state") {
          setProject(data.state);
          if (data.state?.id) scheduleProjectSideRefresh(data.state.id);
        } else if (data.id) {
          setProject(data);
          scheduleProjectSideRefresh(data.id);
        }
      } catch (err) {
        console.error("Error parsing websocket message", err);
      }
    };
    ws.onerror = () => setError("No se pudo conectar al WebSocket del orquestador.");
    return () => {
      ws.onmessage = null;
      ws.onerror = null;
      ws.close();
      if (streamFlushFrame.current !== null) {
        window.cancelAnimationFrame(streamFlushFrame.current);
        streamFlushFrame.current = null;
      }
      if (sideRefreshTimer.current !== null) {
        window.clearTimeout(sideRefreshTimer.current);
        sideRefreshTimer.current = null;
      }
      flushStreamTokens();
    };
  }, [projectId, enqueueStreamToken, flushStreamTokens, scheduleProjectSideRefresh, setError, setProject]);

  return { streamBuffers };
}
