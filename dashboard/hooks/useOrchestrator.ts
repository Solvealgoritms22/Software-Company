"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiBase, apiFetch } from "../lib/orchestratorApi";
import { useProjectActions } from "./useProjectActions";
import { useProjectStream } from "./useProjectStream";
import type { AgentRegistry, AgentTrace, CompanySettings, Deliverable, Department, DepartmentRegistry, McpCatalog, McpSecretsResponse, ProjectState, ProjectUsageSummary, Skill, ToolApproval } from "./orchestratorTypes";

export type * from "./orchestratorTypes";
export function useOrchestrator() {
  const [project, setProject] = useState<ProjectState | null>(null);
  const [projects, setProjects] = useState<ProjectState[]>([]);
  const [mcpCatalog, setMcpCatalog] = useState<McpCatalog | null>(null);
  const [mcpExport, setMcpExport] = useState<Record<string, unknown> | null>(null);
  const [mcpSecrets, setMcpSecrets] = useState<McpSecretsResponse | null>(null);
  const [agentRegistry, setAgentRegistry] = useState<AgentRegistry | null>(null);
  const [departmentRegistry, setDepartmentRegistry] = useState<DepartmentRegistry | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [workspace, setWorkspace] = useState<any | null>(null);
  const [projectTraces, setProjectTraces] = useState<AgentTrace[]>([]);
  const [projectUsage, setProjectUsage] = useState<ProjectUsageSummary | null>(null);
  const [toolApprovals, setToolApprovals] = useState<ToolApproval[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/projects`);
    if (!response.ok) return;
    setProjects(await response.json());
  }, []);


  const {
    createProject,
    deleteProject,
    stopProject,
    openWorkspace,
    sendChat,
    approveContract,
    retryProject,
    rollbackPhase,
  } = useProjectActions({
    project,
    setProject,
    setProjectUsage,
    setError,
    refreshProjects,
  });

  const refreshProjectTraces = useCallback(async (projectId: string) => {
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/traces?limit=100`);
    if (!response.ok) return;
    const payload = await response.json();
    setProjectTraces(payload.traces || []);
  }, []);

  const refreshProjectUsage = useCallback(async (projectId: string) => {
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/usage`);
    if (!response.ok) return;
    setProjectUsage(await response.json());
  }, []);

  const refreshToolApprovals = useCallback(async (projectId: string) => {
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/tool-approvals`);
    if (!response.ok) return;
    const payload = await response.json();
    setToolApprovals(payload.approvals || []);
  }, []);

  const decideToolApproval = useCallback(async (projectId: string, approvalId: string, approved: boolean, note?: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/tool-approvals/${encodeURIComponent(approvalId)}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, note, decided_by: "founder" })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await refreshToolApprovals(projectId);
    await refreshProjects();
  }, [refreshProjects, refreshToolApprovals]);

  const refreshMcpCatalog = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/mcp/catalog`);
    if (!response.ok) return;
    setMcpCatalog(await response.json());
  }, []);

  const refreshMcpSecrets = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/mcp/secrets`);
    if (!response.ok) return;
    setMcpSecrets(await response.json());
  }, []);

  const toggleMcpServer = useCallback(async (name: string) => {
    const response = await apiFetch(`${apiBase}/mcp/catalog/${name}/toggle`, { method: "POST" });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await refreshMcpCatalog();
    await refreshMcpSecrets();
  }, [refreshMcpCatalog, refreshMcpSecrets]);

  const upsertMcpServer = useCallback(async (name: string, payload: Record<string, unknown>) => {
    const response = await apiFetch(`${apiBase}/mcp/catalog/${name}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await refreshMcpCatalog();
    await refreshMcpSecrets();
  }, [refreshMcpCatalog, refreshMcpSecrets]);

  const saveMcpSecret = useCallback(async (key: string, value: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/mcp/secrets/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) {
      const message = await response.text();
      setError(message);
      throw new Error(message);
    }
    await refreshMcpSecrets();
  }, [refreshMcpSecrets]);

  const deleteMcpSecret = useCallback(async (key: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/mcp/secrets/${encodeURIComponent(key)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await refreshMcpSecrets();
  }, [refreshMcpSecrets]);

  const exportMcpConfig = useCallback(async (client: string) => {
    const response = await apiFetch(`${apiBase}/mcp/export/${client}`);
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setMcpExport(await response.json());
  }, []);

  const refreshWorkspace = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/workspace`);
    if (!response.ok) return;
    setWorkspace(await response.json());
  }, []);

  const refreshAgentRegistry = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/agents`);
    if (!response.ok) return;
    setAgentRegistry(await response.json());
  }, []);

  const updateAgent = useCallback(async (agentId: string, payload: Record<string, unknown>) => {
    const response = await apiFetch(`${apiBase}/agents/${agentId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const message = await response.text();
      setError(message);
      throw new Error(message);
    }
    await refreshAgentRegistry();
  }, [refreshAgentRegistry]);

  const refreshDepartments = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/departments`);
    if (!response.ok) return;
    setDepartmentRegistry(await response.json());
  }, []);

  const createDepartment = useCallback(async (payload: Omit<Department, "id"> & { id: string }) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/departments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    await refreshDepartments();
    return true;
  }, [refreshDepartments]);

  const updateDepartment = useCallback(async (id: string, payload: Partial<Department>) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/departments/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    await refreshDepartments();
    return true;
  }, [refreshDepartments]);

  const deleteDepartment = useCallback(async (id: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/departments/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    await refreshDepartments();
    await refreshAgentRegistry(); // Because it unsets department_id
    return true;
  }, [refreshDepartments, refreshAgentRegistry]);

  const refreshSkills = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/skills`);
    if (!response.ok) return;
    setSkills(await response.json());
  }, []);

  const createSkill = useCallback(async (name: string, description: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setSkills(await response.json());
  }, []);

  const updateSkill = useCallback(async (oldName: string, name: string, description: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/skills`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_name: oldName, name, description })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setSkills(await response.json());
    await refreshAgentRegistry();
  }, [refreshAgentRegistry]);

  const deleteSkill = useCallback(async (name: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/skills/${encodeURIComponent(name)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    setSkills(await response.json());
    await refreshAgentRegistry();
    return true;
  }, [refreshAgentRegistry]);

  const refreshDeliverables = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/deliverables`);
    if (!response.ok) return;
    setDeliverables(await response.json());
  }, []);

  const createDeliverable = useCallback(async (payload: Omit<Deliverable, "id">) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/deliverables`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    setDeliverables(await response.json());
    return true;
  }, []);

  const updateDeliverable = useCallback(async (old_code: string, payload: Deliverable) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/deliverables`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old_code, ...payload })
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    setDeliverables(await response.json());
    await refreshAgentRegistry();
    return true;
  }, [refreshAgentRegistry]);

  const deleteDeliverable = useCallback(async (code: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/deliverables/${encodeURIComponent(code)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    setDeliverables(await response.json());
    await refreshAgentRegistry();
    return true;
  }, [refreshAgentRegistry]);

  const createAgent = useCallback(async (agentId: string, payload: Record<string, unknown>) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent_id: agentId, ...payload })
    });
    if (!response.ok) {
      setError(await response.text());
      return false;
    }
    await refreshAgentRegistry();
    return true;
  }, [refreshAgentRegistry]);

  const refreshSettings = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/settings`);
    if (!response.ok) return;
    setSettings(await response.json());
  }, []);

  const updateSettings = useCallback(async (payload: CompanySettings) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setSettings(updated);
    if (updated.theme) {
      localStorage.setItem("company_theme", updated.theme);
      if (updated.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, []);

  useEffect(() => {
    refreshProjects().catch(() => undefined);
    refreshMcpCatalog().catch(() => undefined);
    refreshMcpSecrets().catch(() => undefined);
    refreshAgentRegistry().catch(() => undefined);
    refreshDepartments().catch(() => undefined);
    refreshSkills().catch(() => undefined);
    refreshDeliverables().catch(() => undefined);
    refreshSettings().catch(() => undefined);
    refreshWorkspace().catch(() => undefined);
  }, [refreshProjects, refreshMcpCatalog, refreshMcpSecrets, refreshAgentRegistry, refreshDepartments, refreshSkills, refreshDeliverables, refreshSettings, refreshWorkspace]);

  const { streamBuffers } = useProjectStream({
    projectId: project?.id,
    setProject,
    setError,
    refreshProjectTraces,
    refreshProjectUsage,
    refreshToolApprovals,
  });

  useEffect(() => {
    if (settings?.theme) {
      localStorage.setItem("company_theme", settings.theme);
      if (settings.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [settings?.theme]);

  return useMemo(
    () => ({
      project,
      projects,
      mcpCatalog,
      mcpExport,
      mcpSecrets,
      agentRegistry,
      departmentRegistry,
      skills,
      deliverables,
      settings,
      workspace,
      projectTraces,
      projectUsage,
      toolApprovals,
      loading: !project && !error,
      error,
      streamBuffers,
      setProject,
      createProject,
      deleteProject,
      stopProject,
      openWorkspace,
      sendChat,
      approveContract,
      refreshProjects,
      refreshMcpCatalog,
      refreshMcpSecrets,
      toggleMcpServer,
      upsertMcpServer,
      saveMcpSecret,
      deleteMcpSecret,
      exportMcpConfig,
      refreshAgentRegistry,
      updateAgent,
      refreshDepartments,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      refreshSkills,
      createSkill,
      updateSkill,
      deleteSkill,
      refreshDeliverables,
      createDeliverable,
      updateDeliverable,
      deleteDeliverable,
      createAgent,
      refreshSettings,
      updateSettings,
      refreshWorkspace,
      refreshProjectTraces,
      refreshProjectUsage,
      refreshToolApprovals,
      decideToolApproval,
      retryProject,
      rollbackPhase,
      apiBase
    }),
    [
      project,
      projects,
      mcpCatalog,
      mcpExport,
      mcpSecrets,
      agentRegistry,
      departmentRegistry,
      skills,
      deliverables,
      settings,
      workspace,
      projectTraces,
      projectUsage,
      toolApprovals,
      error,
      createProject,
      deleteProject,
      stopProject,
      openWorkspace,
      sendChat,
      approveContract,
      refreshProjects,
      refreshMcpCatalog,
      refreshMcpSecrets,
      toggleMcpServer,
      upsertMcpServer,
      saveMcpSecret,
      deleteMcpSecret,
      exportMcpConfig,
      refreshAgentRegistry,
      updateAgent,
      refreshDepartments,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      refreshSkills,
      createSkill,
      updateSkill,
      deleteSkill,
      refreshDeliverables,
      createDeliverable,
      updateDeliverable,
      deleteDeliverable,
      createAgent,
      refreshSettings,
      updateSettings,
      refreshWorkspace,
      refreshProjectTraces,
      refreshProjectUsage,
      refreshToolApprovals,
      decideToolApproval,
      retryProject,
      rollbackPhase
    ]
  );
}

