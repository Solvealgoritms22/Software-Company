"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { apiBase, apiFetch, websocketUrl } from "../lib/orchestratorApi";

export type PhaseStatus = "pending" | "running" | "completed" | "failed";

export type ProjectState = {
  id: string;
  name: string;
  client_goal: string;
  budget?: string | null;
  status: "created" | "running" | "waiting_approval" | "waiting_intervention" | "completed" | "failed";
  current_phase: string;
  phases: Record<
    string,
    {
      id: string;
      agent: string;
      depends_on: string[];
      status: PhaseStatus;
      started_at?: string | null;
      completed_at?: string | null;
      error?: string | null;
    }
  >;
  artifacts: ProjectArtifact[];
  logs: Array<{
    id: string;
    agent: string;
    phase: string;
    message: string;
    metadata: Record<string, unknown>;
    created_at: string;
  }>;
  created_at: string;
  updated_at: string;
};

export type ProjectArtifact = {
  id: string;
  type: string;
  agent: string;
  title: string;
  content: Record<string, unknown>;
  uri?: string | null;
  created_at: string;
};

export type McpCatalog = {
  servers: Record<
    string,
    {
      enabled?: boolean;
      kind?: string;
      category?: string;
      display_name?: string;
      description?: string;
      icon_url?: string;
      url?: string;
      docs_url?: string;
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      env_keys?: string[];
      required_for?: string[];
      install_hint?: string;
      library_ids?: string[];
    }
  >;
};

export type McpSecretState = {
  key: string;
  configured: boolean;
  masked: string;
  source: "local_store" | "runtime_env" | "missing";
};

export type McpSecretsResponse = {
  secrets: Record<string, McpSecretState>;
  storage?: {
    path?: string;
    encrypted?: boolean;
    gitignored?: boolean;
    note?: string;
  };
};

export type Skill = {
  name: string;
  description: string;
};

export type Deliverable = {
  code: string;
  name: string;
  description: string;
};

export type AgentRegistry = {
  agents: Record<
    string,
    {
      display_name?: string;
      name?: string;
      avatar_url?: string;
      provider?: string;
      model?: string;
      fallback_model?: string;
      reasoning_effort?: string;
      image_provider?: string;
      image_model?: string;
      responsibilities?: string[];
      skills?: string[];
      tools?: string[];
      deliverables?: string[];
      department_id?: string;
      reports_to?: string;
    }
  >;
};

export type Department = {
  id: string;
  title: string;
  description: string;
  parent_id?: string | null;
  tone: string;
  icon_name: string;
};

export type DepartmentRegistry = {
  departments: Record<string, Department>;
};

export type CompanySettings = {
  company_name: string;
  company_subtitle?: string | null;
  company_description?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  contact_social?: string | null;
  logo_brand?: string | null;
  founder?: string | null;
  collaborators?: string[];
  theme?: "light" | "dark";
  language?: "en" | "es";
  system_prompt_mcp_instructions?: string | null;
};

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
  const [error, setError] = useState<string | null>(null);

  const refreshProjects = useCallback(async () => {
    const response = await apiFetch(`${apiBase}/projects`);
    if (!response.ok) return;
    setProjects(await response.json());
  }, []);

  const createProject = useCallback(async (input: { name: string; client_goal: string; budget?: string }) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input)
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const created = (await response.json()) as ProjectState;
    setProject(created);
    await refreshProjects();
  }, [refreshProjects]);

  const deleteProject = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}`, {
      method: "DELETE"
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    await refreshProjects();
    setProject(prev => prev?.id === projectId ? null : prev);
  }, [refreshProjects]);

  const stopProject = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/stop`, {
      method: "POST"
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject(prev => prev?.id === projectId ? updated : prev);
    await refreshProjects();
  }, [refreshProjects]);

  const openWorkspace = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/open-workspace`, {
      method: "POST"
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
  }, []);

  const sendChat = useCallback(async (projectId: string, message: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject(prev => prev?.id === projectId ? updated : prev);
    await refreshProjects();
  }, [refreshProjects]);

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
  }, [refreshMcpCatalog]);

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
  }, [refreshMcpCatalog]);

  const saveMcpSecret = useCallback(async (key: string, value: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/mcp/secrets/${encodeURIComponent(key)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
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
      setError(await response.text());
      return;
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

  const approveContract = useCallback(async (approved: boolean, founder_note?: string) => {
    if (!project) return;
    const response = await apiFetch(`${apiBase}/projects/${project.id}/approve-contract`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved, founder_note })
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    setProject(await response.json());
  }, [project]);

  const retryProject = useCallback(async (projectId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/retry`, {
      method: "POST"
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject(prev => prev?.id === projectId ? updated : prev);
  }, []);

  const rollbackPhase = useCallback(async (projectId: string, phaseId: string) => {
    setError(null);
    const response = await apiFetch(`${apiBase}/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(phaseId)}`, {
      method: "POST"
    });
    if (!response.ok) {
      setError(await response.text());
      return;
    }
    const updated = await response.json();
    setProject(prev => prev?.id === projectId ? updated : prev);
  }, []);

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

  const [streamBuffers, setStreamBuffers] = useState<Record<string, string>>({});

  const fetchProject = useCallback(async () => {
    if (!project?.id) return;
    try {
      const res = await apiFetch(`${apiBase}/projects/${project.id}`);
      if (!res.ok) throw new Error("Failed to load project");
      const data = await res.json();
      setProject(data);
    } catch (err: any) {
      setError(err.message);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id) {
      fetchProject();
    }
  }, [project?.id, fetchProject]);

  useEffect(() => {
    if (!project?.id) return;
    const ws = new WebSocket(websocketUrl(project.id));
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "token") {
          setStreamBuffers((prev) => ({
            ...prev,
            [data.phase]: (prev[data.phase] || "") + data.token,
          }));
        } else if (data.type === "state") {
          setProject(data.state);
        } else if (data.id) {
          // Backward compatibility if backend sends direct state
          setProject(data);
        }
      } catch (err) {
        console.error("Error parsing websocket message", err);
      }
    };
    ws.onerror = () => setError("No se pudo conectar al WebSocket del orquestador.");
    return () => ws.close();
  }, [project?.id]);

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
      retryProject,
      rollbackPhase
    ]
  );
}

