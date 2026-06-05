"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { useOrchestrator, type AgentRegistry } from "../hooks/useOrchestrator";
import { MenuSelect } from "./MenuSelect";
import { MultiSelect } from "./MultiSelect";
import { ToolTreeSelect, type TreeNode } from "./ToolTreeSelect";
import { sileo } from "sileo";

const REASONING_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium (default)' },
  { value: 'high', label: 'High' }
];
const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', iconUrl: '/providers/openai.svg', invertDark: true },
  { value: 'anthropic', label: 'Anthropic', iconUrl: '/providers/anthropic.svg', invertDark: true },
  { value: 'gemini', label: 'Google Gemini', iconUrl: '/providers/gemini-color.svg' },
  { value: 'deepseek', label: 'DeepSeek', iconUrl: '/providers/deepseek-color.svg' },
  { value: 'azure', label: 'Azure AI', iconUrl: '/providers/azureai-color.svg' },
  { value: 'grok', label: 'xAI Grok', iconUrl: '/providers/grok.svg', invertDark: true },
  { value: 'ollama', label: 'Ollama', iconUrl: 'https://upload.wikimedia.org/wikipedia/commons/1/1a/Ollama_Logo.svg', invertDark: true },
  { value: 'lmstudio', label: 'LM Studio', iconUrl: 'https://cdn.iconscout.com/icon/free/png-256/free-robot-icon-download-in-svg-png-gif-file-formats--chatbot-ai-bot-avatar-user-interface-pack-icons-2651034.png', invertDark: true },
  { value: 'vllm', label: 'vLLM', iconUrl: 'https://vllm.ai/assets/logos/vllm-logo-text-light.png', invertDark: true }
];

const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o-mini' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'o1-mini', label: 'o1-mini' },
    { value: 'o1-preview', label: 'o1-preview' }
  ],
  anthropic: [
    { value: 'claude-3-5-sonnet-latest', label: 'Claude 3.5 Sonnet' },
    { value: 'claude-3-5-haiku-latest', label: 'Claude 3.5 Haiku' },
    { value: 'claude-3-opus-latest', label: 'Claude 3 Opus' }
  ],
  gemini: [
    { value: 'gemini-2.0-flash-exp', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' }
  ],
  deepseek: [
    { value: 'deepseek-chat', label: 'DeepSeek V3 (Chat)' },
    { value: 'deepseek-reasoner', label: 'DeepSeek R1 (Reasoner)' }
  ],
  azure: [
    { value: 'gpt-4o', label: 'GPT-4o (Azure)' },
    { value: 'gpt-4', label: 'GPT-4 (Azure)' },
    { value: 'gpt-35-turbo', label: 'GPT-3.5 Turbo (Azure)' }
  ],
  grok: [
    { value: 'grok-beta', label: 'Grok Beta' },
    { value: 'grok-vision-beta', label: 'Grok Vision Beta' }
  ],
  ollama: [
    { value: 'llama3.2', label: 'Llama 3.2' },
    { value: 'llama3.1', label: 'Llama 3.1' },
    { value: 'mistral', label: 'Mistral' },
    { value: 'qwen2.5', label: 'Qwen 2.5' },
    { value: 'deepseek-r1', label: 'DeepSeek R1' }
  ]
};

const SEXO_OPTIONS = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "no_especificado", label: "No especificado" }
];

type Props = {
  registry: AgentRegistry | null;
  onSave: (agentId: string, payload: Record<string, unknown>) => void;
  onCreateAgent: (agentId: string, payload: Record<string, unknown>) => Promise<boolean>;
};

const avatarPresets = [
  { label: "Valeria", url: "https://api.dicebear.com/9.x/micah/svg?seed=Valeria&backgroundColor=b6e3f4" },
  { label: "Hugo", url: "https://api.dicebear.com/9.x/micah/svg?seed=Hugo&backgroundColor=ffdfbf" },
  { label: "Camila", url: "https://api.dicebear.com/9.x/micah/svg?seed=Camila&backgroundColor=c0aede" },
  { label: "Sofía", url: "https://api.dicebear.com/9.x/micah/svg?seed=Sofia&backgroundColor=ffd5dc" },
  { label: "Elena", url: "https://api.dicebear.com/9.x/micah/svg?seed=Elena&backgroundColor=d1d4f9" },
  { label: "Tomás", url: "https://api.dicebear.com/9.x/micah/svg?seed=Tomas&backgroundColor=b6e3f4" },
  { label: "Mateo", url: "https://api.dicebear.com/9.x/micah/svg?seed=Mateo&backgroundColor=ffdfbf" },
  { label: "Lucas", url: "https://api.dicebear.com/9.x/micah/svg?seed=Lucas&backgroundColor=c0aede" },
  { label: "Sandra", url: "https://api.dicebear.com/9.x/micah/svg?seed=Sandra&backgroundColor=ffd5dc" },
  { label: "Diego", url: "https://api.dicebear.com/9.x/micah/svg?seed=Diego&backgroundColor=d1d4f9" },
  { label: "Marcos", url: "https://api.dicebear.com/9.x/micah/svg?seed=Marcos&backgroundColor=b6e3f4" },
  { label: "Andrés", url: "https://api.dicebear.com/9.x/micah/svg?seed=Andres&backgroundColor=ffdfbf" },
  { label: "Clara", url: "https://api.dicebear.com/9.x/micah/svg?seed=Clara&backgroundColor=c0aede" },
  { label: "Robot A", url: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=RoboA&backgroundColor=ffd5dc" },
  { label: "Robot B", url: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=RoboB&backgroundColor=d1d4f9" },
  { label: "Robot C", url: "https://api.dicebear.com/9.x/bottts-neutral/svg?seed=RoboC&backgroundColor=b6e3f4" },
  { label: "Notion A", url: "https://api.dicebear.com/9.x/notionists/svg?seed=AdvA&backgroundColor=ffdfbf" },
  { label: "Notion B", url: "https://api.dicebear.com/9.x/notionists/svg?seed=AdvB&backgroundColor=c0aede" },
  { label: "Notion C", url: "https://api.dicebear.com/9.x/notionists/svg?seed=AdvC&backgroundColor=ffd5dc" },
  { label: "Lorelei A", url: "https://api.dicebear.com/9.x/lorelei/svg?seed=PixA&backgroundColor=d1d4f9" },
  { label: "Lorelei B", url: "https://api.dicebear.com/9.x/lorelei/svg?seed=PixB&backgroundColor=b6e3f4" },
  { label: "Lorelei C", url: "https://api.dicebear.com/9.x/lorelei/svg?seed=PeepA&backgroundColor=ffdfbf" },
  { label: "Lorelei D", url: "https://api.dicebear.com/9.x/lorelei/svg?seed=PeepB&backgroundColor=c0aede" },
  { label: "Lorelei E", url: "https://api.dicebear.com/9.x/lorelei/svg?seed=PeepC&backgroundColor=ffd5dc" }
];

function handleImageUpload(file: File, callback: (base64: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        callback(dataUrl);
      }
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

const groups: Record<string, string[]> = {
  Direccion: ["ceo"],
  Descubrimiento: ["business_analyst", "legal"],
  Arquitectura: ["software_architect", "frontend_architect"],
  Desarrollo: ["senior_backend", "backend_developer", "frontend_developer", "dba"],
  Calidad: ["qa", "security"],
  Operaciones: ["devops", "technical_writer"]
};

function listToText(value?: string[]) {
  return (value || []).join("\n");
}

function textToList(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function AgentSettings({ registry, onSave, onCreateAgent }: Props) {
  const { departmentRegistry, skills: allSkills, deliverables: allDeliverables, mcpCatalog } = useOrchestrator();
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
        reports_to: reportsTo || null
      });
      sileo.success({ title: "Agente actualizado", description: "Se han guardado los cambios correctamente." });
    } catch (e) {
      sileo.error({ title: "Error al guardar", description: "Ocurrió un error al actualizar el agente." });
    }
  }

  async function handleCreateAgent(e: FormEvent) {
    e.preventDefault();
    setCreateError("");
    
    if (!newAgentId.trim() || !newAgentName.trim() || !newAgentDisplayName.trim()) {
      setCreateError("Por favor completa los campos obligatorios.");
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
      setCreateError("Error al crear el agente. Verifica que el ID sea único.");
    }
  }

  return (
    <div className="grid h-[calc(100vh-73px)] grid-cols-[320px_1fr] overflow-hidden relative">
      <aside className="overflow-auto border-r border-line bg-surface p-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-2">
          <div className="flex items-center gap-2">
            <MaterialIcon name="memory" className="w-4 text-brand" />
            <h2 className="text-sm font-semibold">Agentes</h2>
          </div>
          <button 
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="p-1 rounded bg-brand/10 text-brand hover:bg-brand hover:text-surface transition"
            title="Crear Nuevo Agente"
          >
            <MaterialIcon name="add" className="w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Modelos, skills, tools y entregables configurables.</p>
        <div className="mt-4 space-y-4">
          {Object.entries(grouped).map(([group, ids]) => (
            <section key={group}>
              <div className="mb-2 text-xs font-semibold uppercase text-text-muted">{group}</div>
              <div className="space-y-2">
                {ids.filter((id) => agents[id]).map((id) => {
                  const item = agents[id];
                  const avatar = item.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${item.name || id}`;
                  return (
                    <button
                      key={id}
                      onClick={() => setSelected(id)}
                      className={`w-full rounded-lg border p-3 text-left text-sm transition flex items-center gap-3 ${
                        selected === id ? "border-brand bg-brand text-surface shadow-md shadow-brand/20" : "border-line bg-surface hover:border-[var(--line-strong)] text-text-strong"
                      }`}
                    >
                      <img src={avatar} className="w-8 h-8 rounded-full border border-line bg-surface-muted object-cover" alt="" />
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
                  src={avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || selected}`} 
                  className="w-16 h-16 rounded-full border-2 border-line bg-surface object-cover shadow-sm"
                  alt=""
                />
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-text-strong">{name || selected}</h2>
                  <p className="text-sm text-text-muted">Cargo: {displayName || "Agente"} · ID: {selected}</p>
                </div>
              </div>
              <button className="inline-flex items-center gap-2 rounded-lg bg-brand hover:bg-brand-strong transition px-4 py-2 text-sm font-semibold text-surface shadow-sm">
                <MaterialIcon name="save" className="w-4" />
                Guardar agente
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <Field label="Nombre Real" value={name} onChange={setName} placeholder="Valeria Mendoza" />
              <Field label="Cargo" value={displayName} onChange={setDisplayName} placeholder="CEO Agent" />
              <label className="block text-sm font-medium text-text-strong">
                Sexo
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
                  Proveedor LLM
                </label>
                <MenuSelect
                  options={PROVIDER_OPTIONS}
                  value={provider}
                  onChange={setProvider}
                  placeholder="Selecciona proveedor..."
                />
              </div>
              <div className="flex flex-col justify-end">
                <label className="block text-sm font-medium text-text-strong mb-1">
                  Modelo Principal
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
                    placeholder="Selecciona proveedor primero..."
                  />
                )}
              </div>
              <Field label="Modelo Fallback" value={fallback} onChange={setFallback} placeholder="deepseek-chat" />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="flex flex-col">
                <span className="block text-sm font-medium text-text-strong mb-1">
                  Reasoning Effort
                </span>
                <MenuSelect
                  options={REASONING_OPTIONS}
                  value={reasoningEffort}
                  onChange={setReasoningEffort}
                />
              </div>

              <div className="flex flex-col col-span-2">
                <span className="text-sm font-medium">Avatar</span>
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
                    Subir Foto
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowGallery(true)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong hover:border-brand hover:text-brand shadow-sm transition"
                  >
                    <MaterialIcon name="image" className="w-4" />
                    Galería
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-text-strong">
                Departamento
                <MenuSelect
                  options={[
                    { value: "", label: "Ninguno" },
                    ...departmentList.map(dep => ({ value: dep.id, label: dep.title }))
                  ]}
                  value={departmentId}
                  onChange={setDepartmentId}
                />
              </label>

              <label className="block text-sm font-medium text-text-strong">
                Reporta a
                <MenuSelect
                  options={[
                    { value: "", label: "Nadie" },
                    ...Object.keys(agents).filter(id => id !== selected).map(id => ({ 
                      value: id, 
                      label: agents[id].name || agents[id].display_name || id,
                      iconUrl: agents[id].avatar_url || `https://api.dicebear.com/7.x/initials/svg?seed=${id}`
                    }))
                  ]}
                  value={reportsTo}
                  onChange={setReportsTo}
                />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <Area label="Instrucciones (Responsibilities)" value={responsibilities} onChange={setResponsibilities} placeholder="Escribe las instrucciones..." />
                <div className="flex flex-col justify-start">
                  <label className="block text-sm font-medium text-text-strong mb-1">
                    Skills
                  </label>
                  <MultiSelect
                    options={skillOptions}
                    selected={textToList(skills)}
                    onChange={(arr) => setSkills(listToText(arr))}
                    placeholder="Asignar skill..."
                  />
                </div>
                <div className="flex flex-col">
                  <label className="block text-sm font-medium text-text-strong mb-1">
                    Entregables
                  </label>
                  <MultiSelect
                    options={deliverableOptions}
                    selected={textToList(deliverables)}
                    onChange={(arr) => setDeliverables(listToText(arr))}
                    placeholder="Asignar entregable..."
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
                  title="Configure Tools (MCP)"
                />
              </div>
            </div>
          </form>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            Selecciona un agente.
          </div>
        )}
      </section>

      {/* Modal for creating a new agent */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface rounded-xl border border-line shadow-2xl max-w-2xl w-full max-h-[95vh] flex flex-col fade-in">
            <div className="flex items-center justify-between border-b border-line bg-surface-muted px-6 py-4 rounded-t-xl">
              <div>
                <h3 className="text-base font-bold text-text-strong">Crear Nuevo Agente</h3>
                <p className="text-[10px] text-text-muted font-medium">Define su ID, nombre, cargo y capacidades operativas.</p>
              </div>
              <button 
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-lg border border-line bg-surface text-text-muted hover:text-danger transition"
              >
                <MaterialIcon name="close" className="w-4" />
              </button>
            </div>
            
            <form onSubmit={handleCreateAgent} className="flex-1 overflow-y-auto p-6 space-y-4">
              {createError && (
                <div className="p-3 bg-danger/10 border border-danger/30 text-danger text-xs rounded-lg font-medium">
                  {createError}
                </div>
              )}
              
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-text-strong">
                  ID del Agente
                  <input
                    type="text"
                    required
                    placeholder="qa_lead"
                    value={newAgentId}
                    onChange={(e) => setNewAgentId(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                  />
                </label>
                
                <label className="block text-xs font-semibold text-text-strong">
                  Nombre Real
                  <input
                    type="text"
                    required
                    placeholder="Alejandro Ruiz"
                    value={newAgentName}
                    onChange={(e) => setNewAgentName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                  />
                </label>
              </div>
              
              <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px_1fr]">
                <label className="block text-xs font-semibold text-text-strong">
                  Cargo / Display Name
                  <input
                    type="text"
                    required
                    placeholder="QA Lead Agent"
                    value={newAgentDisplayName}
                    onChange={(e) => setNewAgentDisplayName(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                  />
                </label>

                <label className="block text-xs font-semibold text-text-strong">
                  Sexo
                  <div className="mt-2">
                    <MenuSelect
                      options={SEXO_OPTIONS}
                      value={newAgentSexo}
                      onChange={setNewAgentSexo}
                    />
                  </div>
                </label>
                
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-text-strong">Avatar del Agente</span>
                  <div className="flex items-center gap-2 mt-2">
                    <input 
                      type="file" 
                      id="new-avatar-upload" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleImageUpload(file, setNewAgentAvatar);
                        }
                      }}
                    />
                    <label 
                      htmlFor="new-avatar-upload"
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong hover:border-brand hover:text-brand cursor-pointer shadow-sm transition"
                    >
                      <MaterialIcon name="cloud_upload" className="w-4" />
                      Subir Foto
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowGalleryNew(true)}
                      className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong hover:border-brand hover:text-brand shadow-sm transition"
                    >
                      <MaterialIcon name="image" className="w-4" />
                      Galería
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="flex flex-col">
                  <span className="block text-xs font-semibold text-text-strong mb-2">
                    Proveedor LLM
                  </span>
                  <MenuSelect
                    options={PROVIDER_OPTIONS}
                    value={newAgentProvider}
                    onChange={setNewAgentProvider}
                    placeholder="Selecciona proveedor..."
                  />
                </div>
                
                <label className="block text-xs font-semibold text-text-strong">
                  Modelo Principal
                  {['ollama', 'lmstudio', 'vllm'].includes(newAgentProvider) ? (
                    <input
                      type="text"
                      required
                      placeholder="Ej. llama3.2, mistral..."
                      value={newAgentModel}
                      onChange={(e) => setNewAgentModel(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                    />
                  ) : (
                    <MenuSelect
                      options={
                        newAgentProvider && MODELS_BY_PROVIDER[newAgentProvider] 
                          ? MODELS_BY_PROVIDER[newAgentProvider]
                          : []
                      }
                      value={newAgentModel}
                      onChange={setNewAgentModel}
                      placeholder="Selecciona proveedor primero..."
                      className="mt-2"
                    />
                  )}
                </label>

                <label className="block text-xs font-semibold text-text-strong">
                  Modelo Fallback
                  <input
                    type="text"
                    placeholder="deepseek-chat"
                    value={newAgentFallback}
                    onChange={(e) => setNewAgentFallback(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                  />
                </label>


                  <div className="flex flex-col">
                    <span className="block text-xs font-semibold text-text-strong mb-2">
                      Reasoning Effort
                    </span>
                    <MenuSelect
                      options={REASONING_OPTIONS}
                      value={newAgentReasoningEffort}
                      onChange={setNewAgentReasoningEffort}
                    />
                  </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-4">
                  <Area label="Instrucciones (Responsibilities)" value={newAgentResponsibilities} onChange={setNewAgentResponsibilities} placeholder="Escribe las instrucciones..." />
                  <div className="flex flex-col">
                    <span className="block text-xs font-semibold text-text-strong mb-2">
                      Skills
                    </span>
                    <MultiSelect
                      options={skillOptions}
                      selected={textToList(newAgentSkills)}
                      onChange={(arr) => setNewAgentSkills(listToText(arr))}
                      placeholder="Añadir skill..."
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="block text-xs font-semibold text-text-strong mb-2">
                      Entregables
                    </span>
                    <MultiSelect
                      options={deliverableOptions}
                      selected={textToList(newAgentDeliverables)}
                      onChange={(arr) => setNewAgentDeliverables(listToText(arr))}
                      placeholder="Añadir entregable..."
                    />
                  </div>
                </div>
                <div className="flex flex-col h-full">
                  <ToolTreeSelect 
                    nodes={treeNodes}
                    selectedIds={textToList(newAgentTools).map(t => `tool:${t}`)}
                    onChange={(selected) => {
                      const newTools = selected.filter(id => id.startsWith('tool:')).map(id => id.replace('tool:', ''));
                      setNewAgentTools(listToText(newTools));
                    }}
                    title="Configure Tools (MCP)"
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2 border-t border-line pt-4 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="rounded-lg border border-line bg-surface text-text-strong px-4 py-2 text-xs font-semibold hover:bg-surface-muted transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-surface hover:bg-brand-strong transition shadow-sm"
                >
                  Crear Agente
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Gallery Modal for Existing Agent Edit */}
      {showGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface rounded-xl border border-line shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col scale-in">
            <div className="flex items-center justify-between border-b border-line bg-surface-muted px-6 py-4 rounded-t-xl">
              <div>
                <h3 className="text-base font-bold text-text-strong">Galería de Avatares</h3>
                <p className="text-[10px] text-text-muted font-medium">Selecciona una ilustración preestablecida para el agente.</p>
              </div>
              <button 
                onClick={() => setShowGallery(false)}
                className="p-1.5 rounded-lg border border-line bg-surface text-text-muted hover:text-danger transition"
              >
                <MaterialIcon name="close" className="w-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-4 gap-4">
                {avatarPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setAvatarUrl(preset.url);
                      setShowGallery(false);
                    }}
                    className="flex flex-col items-center gap-2 p-2.5 rounded-xl border border-line hover:border-brand bg-surface hover:bg-surface-muted transition group"
                  >
                    <img src={preset.url} className="w-12 h-12 rounded-full border border-line bg-surface-muted transition group-hover:scale-105" alt="" />
                    <span className="text-[10px] text-text-muted font-semibold truncate max-w-full capitalize group-hover:text-text-strong transition">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gallery Modal for New Agent Creation */}
      {showGalleryNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-surface rounded-xl border border-line shadow-2xl max-w-lg w-full max-h-[80vh] flex flex-col scale-in">
            <div className="flex items-center justify-between border-b border-line bg-surface-muted px-6 py-4 rounded-t-xl">
              <div>
                <h3 className="text-base font-bold text-text-strong">Galería de Avatares</h3>
                <p className="text-[10px] text-text-muted font-medium">Selecciona una ilustración preestablecida para el nuevo agente.</p>
              </div>
              <button 
                onClick={() => setShowGalleryNew(false)}
                className="p-1.5 rounded-lg border border-line bg-surface text-text-muted hover:text-danger transition"
              >
                <MaterialIcon name="close" className="w-4" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              <div className="grid grid-cols-4 gap-4">
                {avatarPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setNewAgentAvatar(preset.url);
                      setShowGalleryNew(false);
                    }}
                    className="flex flex-col items-center gap-2 p-2.5 rounded-xl border border-line hover:border-brand bg-surface hover:bg-surface-muted transition group"
                  >
                    <img src={preset.url} className="w-12 h-12 rounded-full border border-line bg-surface-muted transition group-hover:scale-105" alt="" />
                    <span className="text-[10px] text-text-muted font-semibold truncate max-w-full capitalize group-hover:text-text-strong transition">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  icon
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      <span className="flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <input
        className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  placeholder,
  icon
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      <span className="flex items-center gap-2">
        {icon}
        {label}
      </span>
      <textarea
        className="mt-2 min-h-80 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong leading-6 outline-none transition focus:border-brand"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function TagInput({
  placeholder,
  value,
  onChange,
  className
}: {
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  className?: string;
}) {
  const tags = textToList(value);
  const [inputValue, setInputValue] = useState("");

  const addTag = (tag: string) => {
    const t = tag.trim();
    if (t && !tags.includes(t)) {
      onChange(listToText([...tags, t]));
    }
  };

  const removeTag = (tag: string) => {
    onChange(listToText(tags.filter((t) => t !== tag)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(inputValue);
      setInputValue("");
    } else if (e.key === "Backspace" && inputValue === "" && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  };

  return (
    <div className={`flex flex-wrap items-start gap-1.5 p-2 cursor-text ${className}`} onClick={(e) => {
      const input = e.currentTarget.querySelector("input");
      if (input) input.focus();
    }}>
      {tags.map((tag, i) => (
        <span key={i} className="inline-flex items-center gap-1 rounded bg-surface-muted border border-line px-2 py-1 text-xs font-medium text-text-strong">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="text-text-muted hover:text-danger">
            <MaterialIcon name="close" className="w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        className="flex-1 min-w-[80px] bg-transparent text-xs text-text-strong outline-none placeholder:text-text-muted mt-0.5"
        placeholder={tags.length === 0 ? placeholder : ""}
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => {
          if (inputValue) {
            addTag(inputValue);
            setInputValue("");
          }
        }}
      />
    </div>
  );
}
