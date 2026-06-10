"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import type { AgentRegistry, DepartmentRegistry, Deliverable, McpCatalog, Skill } from "../hooks/useOrchestrator";
import { MenuSelect } from "./MenuSelect";
import { MultiSelect } from "./MultiSelect";
import { ToolTreeSelect, type TreeNode } from "./ToolTreeSelect";
import { sileo } from "sileo";
import { MODELS_BY_PROVIDER, PROVIDER_OPTIONS, REASONING_OPTIONS, SEXO_OPTIONS, agentAvatarUrl, groups, handleImageUpload, listToText, textToList } from "./agentSettingsData";
import { AgentAvatarGallery } from "./AgentAvatarGallery";
import { AgentCreateModal } from "./AgentCreateModal";
import { Area, Field, TagInput } from "./AgentFormControls";

type Props = { registry: AgentRegistry | null; departmentRegistry: DepartmentRegistry | null; allSkills: Skill[]; allDeliverables: Deliverable[]; mcpCatalog: McpCatalog | null; onSave: (agentId: string, payload: Record<string, unknown>) => Promise<void>; onCreateAgent: (agentId: string, payload: Record<string, unknown>) => Promise<boolean>; language?: "en" | "es" };

const translations = {
  en: {
    agentsTitle: "Agents",
    createAgent: "Create New Agent",
    agentDesc: "Configurable models, skills, tools, and deliverables.",
    others: "Others",
    selectAgent: "Select an agent.",
    saveAgent: "Save Agent",
    realName: "Real Name",
    role: "Role",
    sex: "Sex",
    llmProvider: "LLM Provider",
    selectProvider: "Select provider...",
    primaryModel: "Primary Model",
    selectProviderFirst: "Select provider first...",
    fallbackModel: "Fallback Model",
    reasoningEffort: "Reasoning Effort",
    avatar: "Avatar",
    uploadPhoto: "Upload Photo",
    gallery: "Gallery",
    department: "Department",
    none: "None",
    reportsTo: "Reports to",
    nobody: "Nobody",
    instructions: "Instructions (Responsibilities)",
    writeInstructions: "Write instructions...",
    skills: "Skills",
    assignSkill: "Assign skill...",
    deliverables: "Deliverables",
    assignDeliverable: "Assign deliverable...",
    configureTools: "Configure Tools (MCP)",
    agentUpdated: "Agent updated",
    changesSaved: "Changes saved successfully.",
    saveErrorTitle: "Error saving",
    saveErrorDesc: "An error occurred while updating the agent.",
    fillRequired: "Please complete required fields.",
    createError: "Error creating agent. Verify that the ID is unique.",
    avatarGalleryTitle: "Avatar Gallery",
    avatarGallerySub: "Select a preset illustration for the agent.",
    newAvatarGallerySub: "Select a preset illustration for the new agent."
  },
  es: {
    agentsTitle: "Agentes",
    createAgent: "Crear Nuevo Agente",
    agentDesc: "Modelos, skills, tools y entregables configurables.",
    others: "Otros",
    selectAgent: "Selecciona un agente.",
    saveAgent: "Guardar agente",
    realName: "Nombre Real",
    role: "Cargo",
    sex: "Sexo",
    llmProvider: "Proveedor LLM",
    selectProvider: "Selecciona proveedor...",
    primaryModel: "Modelo Principal",
    selectProviderFirst: "Selecciona proveedor primero...",
    fallbackModel: "Modelo Fallback",
    reasoningEffort: "Reasoning Effort",
    avatar: "Avatar",
    uploadPhoto: "Subir Foto",
    gallery: "Galería",
    department: "Departamento",
    none: "Ninguno",
    reportsTo: "Reporta a",
    nobody: "Nadie",
    instructions: "Instrucciones (Responsibilities)",
    writeInstructions: "Escribe las instrucciones...",
    skills: "Skills",
    assignSkill: "Asignar skill...",
    deliverables: "Entregables",
    assignDeliverable: "Asignar entregable...",
    configureTools: "Configure Tools (MCP)",
    agentUpdated: "Agente actualizado",
    changesSaved: "Se han guardado los cambios correctamente.",
    saveErrorTitle: "Error al guardar",
    saveErrorDesc: "Ocurrió un error al actualizar el agente.",
    fillRequired: "Por favor completa los campos obligatorios.",
    createError: "Error al crear el agente. Verifica que el ID sea único.",
    avatarGalleryTitle: "Galeria de Avatares",
    avatarGallerySub: "Selecciona una ilustracion preestablecida para el agente.",
    newAvatarGallerySub: "Selecciona una ilustracion preestablecida para el nuevo agente."
  }
};

export function AgentSettings({ registry, departmentRegistry, allSkills, allDeliverables, mcpCatalog, onSave, onCreateAgent, language = "en" }: Props) {
  const t = translations[language];
  const departments = departmentRegistry?.departments || {};
  const departmentList = Object.keys(departments).map(id => ({ ...departments[id], id }));

  const skillOptions = (allSkills || []).map(s => ({ value: s.name, label: s.name }));
  const deliverableOptions = (allDeliverables || []).map(d => ({ value: d.code, label: d.name }));
  const mcpServers = mcpCatalog?.servers || {};
  const toolOptions = Object.keys(mcpServers).map(t => ({ value: t, label: t }));

  const treeNodes = useMemo<TreeNode[]>(() => {
    // Agrupamos los MCP servers por categoría si la tienen, sino en "General"
    const mcpServersList = Object.keys(mcpServers).map(t => ({ id: t, ...mcpServers[t] }));
    const categories = Array.from(new Set(mcpServersList.map(s => s.category || "General")));
    
    const nativeCat = {
      id: "cat-native",
      label: "Herramientas Nativas",
      icon: <MaterialIcon name="build" className="w-4" />,
      children: [
        { id: "tool:execute_command", label: "execute_command", description: "Consola" },
        { id: "tool:read_file", label: "read_file", description: "Leer Archivo" },
        { id: "tool:write_file", label: "write_file", description: "Escribir Archivo" },
        { id: "tool:web_search", label: "web_search", description: "Búsqueda Web" },
        { id: "tool:fetch_url", label: "fetch_url", description: "Navegar Web (Fetch)" },
        { id: "tool:download_resource", label: "download_resource", description: "Descargar Recurso" },
        { id: "tool:generate_image", label: "generate_image", description: "Generar Imagen" },
        { id: "tool:edit_image", label: "edit_image", description: "Editar Imagen" },
        { id: "tool:get_weather", label: "get_weather", description: "Clima" },
        { id: "tool:convert_currency", label: "convert_currency", description: "Conversión de Divisas" }
      ]
    };
    return [nativeCat, ...categories.map(cat => ({
      id: `cat-${cat}`,
      label: cat,
      icon: <MaterialIcon name="build" className="w-4" />,
      children: mcpServersList.filter(s => (s.category || "General") === cat).map(s => ({
        id: `tool:${s.id}`,
        label: s.id,
        description: s.description || "MCP Server"
      }))
    }))];
  }, [mcpServers]);

  const agents = registry?.agents || {};
  const firstAgent = Object.keys(agents)[0] || null;
  const [selected, setSelected] = useState<string | null>(firstAgent);
  const agent = selected ? agents[selected] : null;

  const [displayName, setDisplayName] = useState("");
  const [name, setName] = useState("");
  const [sexo, setSexo] = useState("no_especificado");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [fallback, setFallback] = useState("");
  const [reasoningEffort, setReasoningEffort] = useState("medium");
  const [responsibilities, setResponsibilities] = useState("");
  const [skills, setSkills] = useState("");
  const [tools, setTools] = useState("");
  const [deliverables, setDeliverables] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [reportsTo, setReportsTo] = useState("");

  // Create Agent modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newAgentId, setNewAgentId] = useState("");
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentDisplayName, setNewAgentDisplayName] = useState("");
  const [newAgentSexo, setNewAgentSexo] = useState("no_especificado");
  const [newAgentAvatar, setNewAgentAvatar] = useState("");
  const [newAgentProvider, setNewAgentProvider] = useState("openai");
  const [newAgentModel, setNewAgentModel] = useState("gpt-4.1-mini");
  const [newAgentFallback, setNewAgentFallback] = useState("");
  const [newAgentReasoningEffort, setNewAgentReasoningEffort] = useState("medium");
  const [newAgentResponsibilities, setNewAgentResponsibilities] = useState("");
  const [newAgentSkills, setNewAgentSkills] = useState("");
  const [newAgentTools, setNewAgentTools] = useState("");
  const [newAgentDeliverables, setNewAgentDeliverables] = useState("");
  const [createError, setCreateError] = useState("");

  const [showGallery, setShowGallery] = useState(false);
  const [showGalleryNew, setShowGalleryNew] = useState(false);

  useEffect(() => {
    if (!selected && firstAgent) {
      setSelected(firstAgent);
    }
  }, [firstAgent, selected]);

  useEffect(() => {
    if (!agent) return;
    setDisplayName(agent.display_name || "");
    setName(agent.name || "");
    setSexo(agent.sexo || "no_especificado");
    setAvatarUrl(agent.avatar_url || "");
    setProvider(agent.provider || "");
    setModel(agent.model || "");
    setFallback(agent.fallback_model || "");
    setReasoningEffort(agent.reasoning_effort || "medium");
    setResponsibilities(listToText(agent.responsibilities));
    setSkills(listToText(agent.skills));
    setTools(listToText(agent.tools));
    setDeliverables(listToText(agent.deliverables));
    setDepartmentId(agent.department_id || "");
    setReportsTo(agent.reports_to || "");
  }, [agent, selected]);

  const grouped = useMemo(() => {
    const known = new Set(Object.values(groups).flat());
    const result = { ...groups };
    const other = Object.keys(agents).filter((id) => !known.has(id));
    if (other.length) result.Otros = other;
    return result;
  }, [agents]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    try {
      await onSave(selected, {
        display_name: displayName,
        name,
        sexo,
        avatar_url: avatarUrl,
        provider,
        model,
        fallback_model: fallback,
        reasoning_effort: reasoningEffort,
        responsibilities: textToList(responsibilities),
        skills: textToList(skills),
        tools: textToList(tools),
        deliverables: textToList(deliverables),
        department_id: departmentId || null,
        reports_to: reportsTo || null,
      });
      sileo.success({ title: t.agentUpdated, description: t.changesSaved });
    } catch (e: any) {
      sileo.error({ title: t.saveErrorTitle, description: e.message || t.saveErrorTitle });
    }
  }
  async function handleCreateAgent(e: FormEvent) {
    e.preventDefault();
    setCreateError("");
    
    if (!newAgentId.trim() || !newAgentName.trim() || !newAgentDisplayName.trim()) {
      setCreateError(t.fillRequired);
      return;
    }
    
    const idClean = newAgentId.trim().toLowerCase().replace(/\s+/g, "_");
    
    const payload = {
      display_name: newAgentDisplayName.trim(),
      name: newAgentName.trim(),
      sexo: newAgentSexo,
      avatar_url: newAgentAvatar.trim() || undefined,
      provider: newAgentProvider.trim(),
      model: newAgentModel.trim(),
      fallback_model: newAgentFallback.trim() || undefined,
      reasoning_effort: newAgentReasoningEffort,
      responsibilities: textToList(newAgentResponsibilities),
      skills: textToList(newAgentSkills),
      tools: textToList(newAgentTools),
      deliverables: textToList(newAgentDeliverables)
    };
    
    const success = await onCreateAgent(idClean, payload);
    if (success) {
      setIsCreateModalOpen(false);
      setSelected(idClean);
      setNewAgentId("");
      setNewAgentName("");
      setNewAgentDisplayName("");
      setNewAgentSexo("no_especificado");
      setNewAgentAvatar("");
      setNewAgentProvider("openai");
      setNewAgentModel("gpt-4.1-mini");
      setNewAgentFallback("");
      setNewAgentReasoningEffort("medium");
      setNewAgentResponsibilities("");
      setNewAgentSkills("");
      setNewAgentTools("");
      setNewAgentDeliverables("");
    } else {
      setCreateError(t.createError);
    }
  }

  return (
    <div className="grid h-[calc(100vh-73px)] grid-cols-[320px_1fr] overflow-hidden relative">
      <aside className="overflow-auto border-r border-line bg-surface p-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
          <div className="flex items-center gap-2">
            <MaterialIcon name="memory" className="w-4 text-brand" />
            <h2 className="text-sm font-semibold">{t.agentsTitle}</h2>
          </div>
          <button 
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="p-1 rounded bg-brand/10 text-brand hover:bg-brand hover:text-surface transition"
            title={t.createAgent}
          >
            <MaterialIcon name="add" className="w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">{t.agentDesc}</p>
        <div className="mt-4 space-y-4">
          {Object.entries(grouped).map(([group, ids]) => (
            <section key={group}>
              <div className="mb-2 text-xs font-semibold uppercase text-text-muted">{group === "Otros" && language === "en" ? t.others : group}</div>
              <div className="space-y-2">
                {ids.filter((id) => agents[id]).map((id) => {
                  const item = agents[id];
                  const avatar = item.avatar_url || agentAvatarUrl(item.name || id);
                  return (
                    <button
                      key={id}
                      onClick={() => setSelected(id)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition flex items-center gap-3 ${
                        selected === id ? "border-brand bg-brand text-surface shadow-md shadow-brand/20" : "border-line bg-surface hover:border-[var(--line-strong)] text-text-strong"
                      }`}
                    >
                      <img src={avatar} className="avatar-image w-8 h-8 rounded-full border border-line object-fill" alt="" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{item.name || id}</div>
                        <div className={`text-xs truncate ${selected === id ? "opacity-70" : "text-text-muted"}`}>
                          {item.display_name || id}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      </aside>

      <section className="overflow-auto p-6">
        {agent && selected ? (
          <form onSubmit={submit} className="mx-auto max-w-5xl space-y-5 rise-in">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <img 
                  src={avatarUrl || agentAvatarUrl(name || selected)}
                  className="avatar-image w-16 h-16 rounded-full border-2 border-line object-fill shadow-sm"
                  alt=""
                />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-strong">{name || selected}</h2>
                  <p className="text-sm text-text-muted">{t.role}: {displayName || "Agent"} · ID: {selected}</p>
                </div>
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand-strong transition px-4 py-2 text-sm font-semibold text-surface shadow-sm">
                <MaterialIcon name="save" className="w-4" />
                {t.saveAgent}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Field label={t.realName} value={name} onChange={setName} placeholder="Valeria Mendoza" />
              <Field label={t.role} value={displayName} onChange={setDisplayName} placeholder="CEO Agent" />
              <label className="block text-sm font-medium text-text-strong">
                {t.sex}
                <div className="mt-2">
                  <MenuSelect
                    options={SEXO_OPTIONS}
                    value={sexo}
                    onChange={setSexo}
                  />
                </div>
              </label>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col justify-end">
                <label className="block text-sm font-medium text-text-strong mb-1">
                  {t.llmProvider}
                </label>
                <MenuSelect
                  options={PROVIDER_OPTIONS}
                  value={provider}
                  onChange={setProvider}
                  placeholder={t.selectProvider}
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="block text-sm font-medium text-text-strong mb-1">
                  {t.primaryModel}
                </label>
                {['ollama', 'lmstudio', 'vllm'].includes(provider) ? (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Ej. llama3.2, mistral..."
                    className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand"
                  />
                ) : (
                  <MenuSelect
                    options={
                      provider && MODELS_BY_PROVIDER[provider] 
                        ? [
                            ...MODELS_BY_PROVIDER[provider],
                            ...(model && !MODELS_BY_PROVIDER[provider].some(m => m.value === model) 
                              ? [{ value: model, label: `${model}` }] 
                              : [])
                          ]
                        : (model ? [{ value: model, label: model }] : [])
                    }
                    value={model}
                    onChange={setModel}
                    placeholder={t.selectProviderFirst}
                  />
                )}
              </div>
              <Field label={t.fallbackModel} value={fallback} onChange={setFallback} placeholder="deepseek-chat" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col">
                <span className="block text-sm font-medium text-text-strong mb-1">
                  {t.reasoningEffort}
                </span>
                <MenuSelect
                  options={REASONING_OPTIONS}
                  value={reasoningEffort}
                  onChange={setReasoningEffort}
                />
              </div>

              <div className="flex flex-col col-span-2">
                <span className="text-sm font-medium">{t.avatar}</span>
                <div className="flex items-center gap-2 mt-2">
                  <input 
                    type="file" 
                    id="avatar-upload" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleImageUpload(file, setAvatarUrl);
                      }
                    }}
                  />
                  <label 
                    htmlFor="avatar-upload"
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong hover:border-brand hover:text-brand cursor-pointer shadow-sm transition"
                  >
                    <MaterialIcon name="upload" className="w-4" />
                    {t.uploadPhoto}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGallery(true)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong hover:border-brand hover:text-brand shadow-sm transition"
                  >
                    <MaterialIcon name="image" className="w-4" />
                    {t.gallery}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-text-strong">
                {t.department}
                <MenuSelect
                  options={[
                    { value: "", label: t.none },
                    ...departmentList.map(dep => ({ value: dep.id, label: dep.title }))
                  ]}
                  value={departmentId}
                  onChange={setDepartmentId}
                />
              </label>

              <label className="block text-sm font-medium text-text-strong">
                {t.reportsTo}
                <MenuSelect
                  options={[
                    { value: "", label: t.nobody },
                    ...Object.keys(agents).filter(id => id !== selected).map(id => ({ 
                      value: id, 
                      label: agents[id].name || agents[id].display_name || id,
                      iconUrl: agents[id].avatar_url || agentAvatarUrl(id)
                    }))
                  ]}
                  value={reportsTo}
                  onChange={setReportsTo}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <Area label={t.instructions} value={responsibilities} onChange={setResponsibilities} placeholder={t.writeInstructions} />
                <div className="flex flex-col justify-start">
                  <label className="block text-sm font-medium text-text-strong mb-1">
                    {t.skills}
                  </label>
                  <MultiSelect
                    options={skillOptions}
                    selected={textToList(skills)}
                    onChange={(arr) => setSkills(listToText(arr))}
                    placeholder={t.assignSkill}
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-text-strong mb-1">
                    {t.deliverables}
                  </label>
                  <MultiSelect
                    options={deliverableOptions}
                    selected={textToList(deliverables)}
                    onChange={(arr) => setDeliverables(listToText(arr))}
                    placeholder={t.assignDeliverable}
                  />
                </div>
              </div>

              <div className="flex flex-col justify-start h-full">
                <ToolTreeSelect 
                  nodes={treeNodes}
                  selectedIds={textToList(tools).map(t => `tool:${t}`)}
                  onChange={(selected) => {
                    const newTools = selected.filter(id => id.startsWith('tool:')).map(id => id.replace('tool:', ''));
                    setTools(listToText(newTools));
                  }}
                  title={t.configureTools}
                />
              </div>
            </div>
          </form>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            {t.selectAgent}
          </div>
        )}
      </section>

      {/* Modal for creating a new agent */}
      <AgentCreateModal
        open={isCreateModalOpen}
        error={createError}
        values={{
          id: newAgentId,
          name: newAgentName,
          displayName: newAgentDisplayName,
          sexo: newAgentSexo,
          avatar: newAgentAvatar,
          provider: newAgentProvider,
          model: newAgentModel,
          fallback: newAgentFallback,
          reasoningEffort: newAgentReasoningEffort,
          responsibilities: newAgentResponsibilities,
          skills: newAgentSkills,
          tools: newAgentTools,
          deliverables: newAgentDeliverables,
        }}
        setters={{
          id: setNewAgentId,
          name: setNewAgentName,
          displayName: setNewAgentDisplayName,
          sexo: setNewAgentSexo,
          avatar: setNewAgentAvatar,
          provider: setNewAgentProvider,
          model: setNewAgentModel,
          fallback: setNewAgentFallback,
          reasoningEffort: setNewAgentReasoningEffort,
          responsibilities: setNewAgentResponsibilities,
          skills: setNewAgentSkills,
          tools: setNewAgentTools,
          deliverables: setNewAgentDeliverables,
        }}
        skillOptions={skillOptions}
        deliverableOptions={deliverableOptions}
        treeNodes={treeNodes}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateAgent}
        onOpenGallery={() => setShowGalleryNew(true)}
        language={language}
      />

      <AgentAvatarGallery
        open={showGallery}
        title={t.avatarGalleryTitle}
        subtitle={t.avatarGallerySub}
        onClose={() => setShowGallery(false)}
        onSelect={setAvatarUrl}
      />
      <AgentAvatarGallery
        open={showGalleryNew}
        title={t.avatarGalleryTitle}
        subtitle={t.newAvatarGallerySub}
        onClose={() => setShowGalleryNew(false)}
        onSelect={setNewAgentAvatar}
      />
    </div>
  );
}
