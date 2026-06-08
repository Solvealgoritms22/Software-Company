"use client";

import { Dispatch, SetStateAction, useCallback } from "react";

import { apiBase, apiFetch } from "../lib/orchestratorApi";
import type { ProjectState, ProjectUsageSummary } from "./orchestratorTypes";

type UseProjectActionsInput = {
  project: ProjectState | null;
  setProject: Dispatch<SetStateAction<ProjectState | null>>;
  setProjectUsage: Dispatch<SetStateAction<ProjectUsageSummary | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  refreshProjects: () => Promise<void>;
};

export function useProjectActions({
  project,
  setProject,
  setProjectUsage,
  setError,
  refreshProjects,
}: UseProjectActionsInput) {
  const createProject = useCallback(async (input: { name: string; client_goal: string; budget?: string }) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const created = (await response.json()) as ProjectState;
    setProject(created);
    await refreshProjects();
  }, [refreshProjects, setError, setProject]);

  const deleteProject = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}`, { method: "DELETE" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await refreshProjects();
    setProject((prev) => prev?.id === projectId ? null : prev);
    setProjectUsage((prev) => prev?.project_id === projectId ? null : prev);
  }, [refreshProjects, setError, setProject, setProjectUsage]);

  const stopProject = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/stop`, { method: "POST" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject((prev) => prev?.id === projectId ? updated : prev);
    await refreshProjects();
  }, [refreshProjects, setError, setProject]);

  const openWorkspace = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/open-workspace`, { method: "POST" });
    if (!response.ok) setError(await response.text());
  }, [setError]);

  const sendChat = useCallback(async (projectId: string, message: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject((prev) => prev?.id === projectId ? updated : prev);
    await refreshProjects();
  }, [refreshProjects, setError, setProject]);

  const approveContract = useCallback(async (approved: boolean, founder_note?: string) => {
    if (!project) return;
    const response = await apiFetch(`${apiBase}/projects/${project.id}/approve-contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, founder_note }),
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setProject(await response.json());
  }, [project, setError, setProject]);

  const retryProject = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/retry`, { method: "POST" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject((prev) => prev?.id === projectId ? updated : prev);
  }, [setError, setProject]);

  const rollbackPhase = useCallback(async (projectId: string, phaseId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(phaseId)}`, { method: "POST" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject((prev) => prev?.id === projectId ? updated : prev);
  }, [setError, setProject]);

  return { createProject, deleteProject, stopProject, openWorkspace, sendChat, approveContract, retryProject, rollbackPhase };
}
