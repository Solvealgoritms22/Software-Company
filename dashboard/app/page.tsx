"use client";

import { FormEvent, ReactNode, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Bot,
  Boxes,
  Building2,
  CheckCircle2,
  Cpu,
  FileText,
  GitBranch,
  LayoutDashboard,
  ChevronLeft,
  ChevronRight,
  Play,
  Settings,
  ShieldCheck,
  Sparkles,
  Network,
  Zap,
  FolderOpen,
  Blocks,
  Plug,
  X,
  Trash2,
  Maximize2,
  Minimize2,
  Loader2,
  Menu,
  ArrowUp
} from "lucide-react";
import { AgentGraph } from "../components/AgentGraph";
import { AgentSettings } from "../components/AgentSettings";
import { DepartmentSettings } from "../components/DepartmentSettings";
import { ProviderSettings } from "../components/ProviderSettings";
import { McpSettings } from "../components/McpSettings";
import { OrgChart } from "../components/OrgChart";
import { SkillsSettings } from "../components/SkillsSettings";
import { DeliverablesSettings } from "../components/DeliverablesSettings";
import { SettingsPanel } from "../components/SettingsPanel";
import { MarkdownRenderer } from "../components/MarkdownRenderer";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { WorkspaceView } from "../components/WorkspaceView";
import { useOrchestrator, type ProjectArtifact } from "../hooks/useOrchestrator";
type View = "factory" | "workspace" | "org" | "departments" | "agents" | "providers" | "mcp" | "skills" | "deliverables" | "settings";

const navItems = [
  { id: "factory" as const, icon: LayoutDashboard },
  { id: "workspace" as const, icon: FolderOpen },
  { id: "org" as const, icon: Building2 },
  { id: "departments" as const, icon: Network },
  { id: "agents" as const, icon: Cpu },
  { id: "providers" as const, icon: Plug },
  { id: "skills" as const, icon: BookOpen },
  { id: "deliverables" as const, icon: FileText },
  { id: "mcp" as const, icon: Blocks },
  { id: "settings" as const, icon: Settings }
];

const localization = {
  en: {
    factory: "Factory",
    workspace: "Workspace",
    org: "Organization Chart",
    departments: "Departments",
    agents: "Agents",
    providers: "Providers",
    skills: "Skills",
    deliverables: "Deliverables",
    mcp: "MCP Servers",
    settings: "Settings",
    factorySubtitle: "Project workflow and execution dashboard.",
    workspaceSubtitle: "Project files and code repository.",
    orgSubtitle: "Structure and profiles of our AI team members.",
    departmentsSubtitle: "Configure departments and organizational hierarchy.",
    agentsSubtitle: "Individual agent parameters and models configuration.",
    providersSubtitle: "Global settings for AI model providers.",
    skillsSubtitle: "Global library of capabilities for agents.",
    deliverablesSubtitle: "Global catalog of agent deliverables.",
    mcpSubtitle: "Manage MCP Servers and Context.",
    settingsSubtitle: "Configure brand assets, theme, language, and GitHub integrations.",
    activeProject: "active project",
    noActiveProject: "no active project",
    console: "Operational Console",
    metricAgents: "Agents",
    metricMcps: "Active MCPs",
    metricPhases: "Phases",
  },
  es: {
    factory: "Fábrica",
    workspace: "Espacio de Trabajo",
    org: "Organigrama",
    departments: "Departamentos",
    agents: "Agentes",
    providers: "Proveedores",
    skills: "Habilidades",
    deliverables: "Entregables",
    mcp: "Servidores MCP",
    settings: "Configuración",
    factorySubtitle: "Dashboard de ejecución y flujo de trabajo del proyecto.",
    workspaceSubtitle: "Archivos del proyecto y repositorio de código.",
    orgSubtitle: "Estructura y perfiles de los miembros de nuestro equipo de IA.",
    departmentsSubtitle: "Configura departamentos y la jerarquía organizativa.",
    agentsSubtitle: "Configuración de modelos y parámetros individuales de agentes.",
    providersSubtitle: "Ajustes globales para proveedores de modelos de IA.",
    skillsSubtitle: "Biblioteca global de capacidades para agentes.",
    deliverablesSubtitle: "Catálogo global de entregables para agentes.",
    mcpSubtitle: "Administrar servidores MCP y contexto.",
    settingsSubtitle: "Configura recursos de marca, tema, idioma e integraciones de GitHub.",
    activeProject: "proyecto activo",
    noActiveProject: "sin proyecto activo",
    console: "Consola Operativa",
    metricAgents: "Agentes",
    metricMcps: "MCPs Activos",
    metricPhases: "Fases",
  }
};

export default function Home() {
  const {
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
    streamBuffers,
    setProject,
    createProject,
    approveContract,
    toggleMcpServer,
    upsertMcpServer,
    saveMcpSecret,
    deleteMcpSecret,
    exportMcpConfig,
    updateAgent,
    createSkill,
    updateSkill,
    deleteSkill,
    refreshDeliverables,
    createDeliverable,
    updateDeliverable,
    deleteDeliverable,
    createAgent,
    updateSettings,
    refreshWorkspace,
    deleteProject,
    stopProject,
    openWorkspace,
    sendChat,
    retryProject,
    rollbackPhase,
    apiBase
  } = useOrchestrator();

  const lang = settings?.language || "en";
  const loc = localization[lang as "en" | "es"] || localization.en;

  const [view, setView] = useState<View>("factory");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const savedView = localStorage.getItem("software-company-view") as View | null;
    if (savedView) {
      setView(savedView);
    }
  }, []);

  const handleSetView = (v: View) => {
    setView(v);
    localStorage.setItem("software-company-view", v);
  };

  useEffect(() => {
    if (settings?.logo_brand) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = settings.logo_brand;
    }
  }, [settings?.logo_brand]);

  const title = loc[view] || "";
  const subtitle = view === "factory"
    ? (project
        ? `${lang === "en" ? "Operational status" : "Estado operativo"} · ${project.status.replace("_", " ")}`
        : `${lang === "en" ? "waiting for project" : "esperando proyecto"}`)
    : (loc[`${view}Subtitle` as keyof typeof loc] || "");
  const [name, setName] = useState("");
  const [goal, setGoal] = useState("");
  const [budget, setBudget] = useState("");

  const [isCreating, setIsCreating] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    try {
      await createProject({ name, client_goal: goal, budget });
    } finally {
      setIsCreating(false);
    }
  }

  const completedPhases = project ? Object.values(project.phases).filter((phase) => phase.status === "completed").length : 0;
  const totalPhases = project ? Object.values(project.phases).length : 15;
  const activeMcps = Object.values(mcpCatalog?.servers || {}).filter((server) => server.enabled).length;
  const totalAgents = Object.keys(agentRegistry?.agents || {}).length;

  return (
    <main className="app-shell transition-colors duration-200 flex">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed md:sticky top-0 left-0 z-50 flex h-screen flex-col border-r border-line bg-surface p-4 md:bg-surface/80 backdrop-blur-xl transition-all duration-300 flex-shrink-0 overflow-hidden ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-full md:translate-x-0'} ${isSidebarOpen ? 'md:w-[280px]' : 'md:w-[80px]'}`}>
        <div className={`flex items-center p-3 relative ${isSidebarOpen ? 'justify-start' : 'justify-center flex-col pt-4 pb-12'} min-h-[66px]`}>
          <div className={`flex items-center gap-3 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-100 flex-col'}`}>
            <div className={`flex items-center justify-center rounded-xl bg-brand text-surface overflow-hidden shadow-sm flex-shrink-0 transition-all ${isSidebarOpen ? 'h-11 w-11' : 'h-8 w-8'}`}>
              {settings?.logo_brand ? (
                <img src={settings.logo_brand} className="w-full h-full object-cover" alt="Logo" />
              ) : (
                <Bot className={`text-white ${isSidebarOpen ? 'h-5 w-5' : 'h-4 w-4'}`} />
              )}
            </div>
            <div className={`min-w-0 flex-1 whitespace-nowrap transition-all duration-300 ${isSidebarOpen ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}`}>
              <div className="text-sm font-bold text-text-strong truncate">{settings?.company_name || "DevFoundry"}</div>
              <div className="text-[10px] text-text-muted font-bold truncate">{settings?.company_subtitle || "AI Software Company"}</div>
            </div>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`absolute ${isSidebarOpen ? 'right-3 top-1/2 -translate-y-1/2' : 'bottom-2 left-1/2 -translate-x-1/2'} rounded-md p-1.5 hover:bg-surface-muted text-text-muted transition-transform`}
            aria-label={isSidebarOpen ? "Colapsar sidebar" : "Expandir sidebar"}
            title={isSidebarOpen ? "Colapsar sidebar" : "Expandir sidebar"}
          >
            <ChevronLeft className={`h-4 w-4 transition-transform ${!isSidebarOpen && 'rotate-180'}`} />
          </button>
        </div>

        <nav className="mt-2 pt-4 space-y-2 flex-1 overflow-y-auto scroll-mask-y pr-2 pb-4 overflow-x-hidden">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Tooltip 
                  key={item.id} 
                >
                  <TooltipTrigger asChild>
                    <button 
                      data-active={view === item.id} 
                      className={`sidebar-button ${isSidebarOpen ? 'px-3 py-2.5 gap-2.5' : 'justify-center p-2.5 gap-0'}`} 
                      onClick={() => { handleSetView(item.id); setIsMobileMenuOpen(false); }}
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" />
                      <span className={`transition-all duration-300 whitespace-nowrap overflow-hidden ${isSidebarOpen ? 'opacity-100 w-auto ml-1' : 'opacity-0 w-0 ml-0'}`}>
                        {loc[item.id]}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" sideOffset={10} className={isSidebarOpen ? 'hidden' : ''}>
                    {loc[item.id]}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </TooltipProvider>
        </nav>

        <div className={`mt-6 grid gap-3 transition-all duration-300 overflow-hidden ${isSidebarOpen ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0 m-0 p-0 border-0'}`}>
          <Metric label={loc.metricAgents} value={String(totalAgents)} icon={<Cpu className="h-4 w-4" />} />
          <Metric label={loc.metricMcps} value={String(activeMcps)} icon={<Boxes className="h-4 w-4" />} />
          <Metric label={loc.metricPhases} value={`${completedPhases}/${totalPhases}`} icon={<CheckCircle2 className="h-4 w-4" />} />
        </div>


      </aside>

      <section className="min-w-0 flex flex-col h-screen flex-1 relative">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/80 px-4 md:px-6 py-3 md:py-4 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                className="md:hidden p-2 -ml-2 text-text-muted hover:text-text-strong rounded-lg hover:bg-surface-muted transition-colors"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menu principal"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-text-strong">{title}</h1>
                <p className="mt-0.5 md:mt-1 text-xs text-text-muted hidden sm:block">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 md:px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm">
              <GitBranch className="h-3.5 w-3.5" />
              {project ? project.status.replace("_", " ") : loc.noActiveProject}
            </div>
          </div>
        </header>

        <div className="flex-1 min-h-0 relative overflow-hidden bg-background">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="absolute inset-0 overflow-y-auto"
            >
              {view === "factory" && (
                <FactoryView
                  name={name}
                  setName={setName}
                  goal={goal}
                  setGoal={setGoal}
                  budget={budget}
                  setBudget={setBudget}
                  onSubmit={submit}
                  isCreating={isCreating}
                  error={error}
                  projects={projects}
                  project={project}
                  setProject={setProject}
                  deleteProject={deleteProject}
                  stopProject={stopProject}
                  openWorkspace={openWorkspace}
                  sendChat={sendChat}
                  retryProject={retryProject}
                  rollbackPhase={rollbackPhase}
                  approveContract={approveContract}
                  registry={agentRegistry}
                  streamBuffers={streamBuffers}
                  language={lang}
                  theme={settings?.theme || "dark"}
                />
              )}

              {view === "workspace" && (
                <WorkspaceView data={workspace} apiBase={apiBase} theme={settings?.theme || "dark"} refreshWorkspace={refreshWorkspace} />
              )}

              {view === "org" && <OrgChart registry={agentRegistry} departmentRegistry={departmentRegistry} />}

              {view === "departments" && <DepartmentSettings />}

              {view === "agents" && (
                <AgentSettings 
                  registry={agentRegistry} 
                  onSave={updateAgent} 
                  onCreateAgent={createAgent} 
                />
              )}

              {view === "providers" && <ProviderSettings />}

              {view === "skills" && (
                <SkillsSettings
                  skills={skills}
                  registry={agentRegistry}
                  onCreate={createSkill}
                  onUpdate={updateSkill}
                  onDelete={deleteSkill}
                  onUpdateAgentSkills={async (agentId, agentSkills) => {
                    await updateAgent(agentId, { skills: agentSkills });
                  }}
                />
              )}

              {view === "deliverables" && (
                <DeliverablesSettings
                  deliverables={deliverables}
                  registry={agentRegistry}
                  onCreate={createDeliverable}
                  onUpdate={updateDeliverable}
                  onDelete={deleteDeliverable}
                  onUpdateAgentDeliverables={async (agentId, agentDeliverables) => {
                    await updateAgent(agentId, { deliverables: agentDeliverables });
                  }}
                />
              )}

              {view === "mcp" && (
                <McpSettings
                  catalog={mcpCatalog}
                  exported={mcpExport}
                  secrets={mcpSecrets}
                  registry={agentRegistry}
                  onToggle={toggleMcpServer}
                  onSave={upsertMcpServer}
                  onSaveSecret={saveMcpSecret}
                  onDeleteSecret={deleteMcpSecret}
                  onExport={exportMcpConfig}
                />
              )}

              {view === "settings" && (
                <SettingsPanel
                  settings={settings}
                  onSave={updateSettings}
                  error={error}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </section>
    </main>
  );
}

const factoryTranslations = {
  en: {
    newProject: "New Project",
    projectName: "Project Name",
    clientRequirement: "Client Goal / Requirement",
    budgetConstraints: "Constraints / Budget",
    createRun: "Create & Execute",
    projects: "Projects",
    noProjects: "No active projects.",
    artifactsControl: "Artifacts & Control",
    pendingContract: "Contract Pending Approval",
    contractPendingDesc: "The Legal Agent has generated the contract. Approve it to proceed to architecture and development.",
    approve: "Approve",
    reject: "Reject",
    deliverableSidebarTitle: "Deliverable Details",
    risksAndBlocks: "Risks & Blocks",
    inputsAndNext: "Inputs & Next Phases",
    rawJson: "Raw JSON Content",
    formattedDeliverable: "Enriched Deliverable",
    viewJson: "View JSON",
    close: "Close",
    operationalConsole: "Operational Console",
    phaseSummary: "Phase Summary",
    generatedDeliverables: "Generated Deliverables",
    viewEnriched: "View enriched deliverable",
    activity: "Operational Logs",
  },
  es: {
    newProject: "Nuevo proyecto",
    projectName: "Proyecto",
    clientRequirement: "Requerimiento del cliente",
    budgetConstraints: "Restricciones / presupuesto",
    createRun: "Crear y ejecutar",
    projects: "Proyectos",
    noProjects: "No hay proyectos activos.",
    artifactsControl: "Artefactos y control",
    pendingContract: "Contrato pendiente",
    contractPendingDesc: "El Legal Agent generó el contrato. Apruébalo para continuar con arquitectura y desarrollo.",
    approve: "Aprobar",
    reject: "Rechazar",
    deliverableSidebarTitle: "Detalle de Entregable",
    risksAndBlocks: "Riesgos y Bloqueos",
    inputsAndNext: "Entradas y Siguientes Fases",
    rawJson: "JSON Crudo",
    formattedDeliverable: "Entregable Formateado",
    viewJson: "Ver JSON",
    close: "Cerrar",
    operationalConsole: "Consola operativa",
    phaseSummary: "Resumen de la fase",
    generatedDeliverables: "Entregables Generados",
    viewEnriched: "Ver entregable enriquecido",
    activity: "Actividad",
  }
};

function FactoryView({
  name,
  setName,
  goal,
  setGoal,
  budget,
  setBudget,
  onSubmit,
  isCreating,
  error,
  projects,
  project,
  setProject,
  deleteProject,
  stopProject,
  openWorkspace,
  sendChat,
  retryProject,
  rollbackPhase,
  approveContract,
  registry,
  streamBuffers,
  language,
  theme
}: {
  name: string;
  setName: (value: string) => void;
  goal: string;
  setGoal: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isCreating: boolean;
  error: string | null;
  projects: ReturnType<typeof useOrchestrator>["projects"];
  project: ReturnType<typeof useOrchestrator>["project"];
  setProject: ReturnType<typeof useOrchestrator>["setProject"];
  deleteProject: (id: string) => Promise<void>;
  stopProject: (id: string) => Promise<void>;
  openWorkspace: (id: string) => Promise<void>;
  sendChat: (id: string, message: string) => Promise<void>;
  retryProject: (id: string) => Promise<void>;
  rollbackPhase: (projectId: string, phaseId: string) => Promise<void>;
  approveContract: ReturnType<typeof useOrchestrator>["approveContract"];
  registry: ReturnType<typeof useOrchestrator>["agentRegistry"];
  streamBuffers: Record<string, string>;
  language: string;
  theme: string;
}) {
  const [selectedArtifact, setSelectedArtifact] = useState<ProjectArtifact | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isCanvasMaximized, setIsCanvasMaximized] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{id: string, name: string} | null>(null);
  const [phaseToRollback, setPhaseToRollback] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);

  const agents = registry?.agents || {};
  const t = factoryTranslations[language as "en" | "es"] || factoryTranslations.en;

  const hasRightSidebar = project && isRightSidebarOpen;
  const gridClass = isCanvasMaximized
    ? "grid-cols-1"
    : isLeftSidebarOpen
      ? hasRightSidebar
        ? "grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(320px,380px)]"
        : "grid-cols-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
      : hasRightSidebar
        ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"
        : "grid-cols-1";

  return (
    <section className={`relative grid h-[calc(100vh-73px)] ${gridClass}`}>
      {!isCanvasMaximized && isLeftSidebarOpen && (
        <aside className="border-r border-line bg-surface p-4 overflow-y-auto scroll-mask-y">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-brand" />
              <span className="text-text-strong">{t.newProject}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen(false)}
              className="p-1.5 rounded-md hover:bg-surface-muted text-text-muted hover:text-text-strong transition"
              title="Ocultar panel izquierdo"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="quiet-card space-y-3 p-4">
            <Field 
              label={t.projectName} 
              value={name} 
              onChange={setName} 
              placeholder="MVP Cliente"
            />
            <Area 
              label={t.clientRequirement} 
              value={goal} 
              onChange={setGoal} 
              minHeight="min-h-28" 
              placeholder="Crear un sistema funcional para gestionar clientes, proyectos y entregables."
            />
            <Area 
              label={t.budgetConstraints} 
              value={budget} 
              onChange={setBudget} 
              minHeight="min-h-20" 
              placeholder="Servicios gratuitos y open source en fase MVP."
            />
            
            {project?.status === "running" ? (
              <button
                type="button"
                onClick={() => stopProject(project.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-[0.98]"
              >
                <Loader2 className="h-4 w-4 animate-spin text-white" />
                Detener Proceso
              </button>
            ) : (
              <button
                disabled={isCreating}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-surface transition hover:translate-y-[-1px] active:scale-[0.98] disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
                {t.createRun}
              </button>
            )}
            {error ? <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
          </form>

          <div className="mt-4 quiet-card p-4">
            <SectionTitle icon={<FileText className="h-4 w-4" />} title={t.projects} />
            <div className="mt-3 space-y-2">
              {projects.length === 0 ? (
                <div className="rounded-lg border border-line bg-surface-muted p-4 text-center">
                  <p className="text-xs font-semibold text-text-muted">{t.noProjects}</p>
                </div>
              ) : (
                projects.map((item) => (
                  <div
                    key={item.id}
                    className={`group relative flex items-center justify-between w-full rounded-lg border text-left text-sm transition hover:shadow-sm ${project?.id === item.id ? 'border-brand bg-brand/5' : 'border-line bg-surface hover:border-[var(--line-strong)]'}`}
                  >
                    <button
                      onClick={() => setProject(item)}
                      className="flex-1 p-3 text-left min-w-0"
                    >
                      <div className="font-semibold text-text-strong truncate">{item.name}</div>
                      <div className="mt-1 text-xs text-[var(--text-muted)] font-semibold flex items-center gap-1">
                        <span className={`h-1.5 w-1.5 rounded-full ${item.status === 'completed' ? 'bg-emerald-500' : item.status === 'running' ? 'bg-brand animate-pulse' : item.status === 'failed' ? 'bg-rose-500' : 'bg-line-strong'}`}></span>
                        {item.status}
                      </div>
                    </button>
                    <div className="flex items-center">
                      <button
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          openWorkspace(item.id);
                        }}
                        className="mr-1 p-1.5 rounded-md hover:bg-brand/10 text-text-muted hover:text-brand opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Abrir Workspace"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setProjectToDelete({ id: item.id, name: item.name });
                        }}
                        className="mr-2 p-1.5 rounded-md hover:bg-rose-500/10 text-text-muted hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Eliminar proyecto"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      )}

      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 rise-in" onClick={() => setProjectToDelete(null)}>
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-strong">Eliminar proyecto</h3>
            <p className="mt-2 text-sm text-text-muted">
              ¿Estás seguro de que deseas eliminar el proyecto <span className="font-semibold text-text-strong">"{projectToDelete.name}"</span>? Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-text-muted hover:bg-surface-muted hover:text-text-strong transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteProject(projectToDelete.id);
                  setProjectToDelete(null);
                }}
                className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition shadow-sm"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="min-w-0 surface-muted relative">
        <div className="h-full relative">
          <AgentGraph project={project} registry={registry} theme={theme} />
          
          {/* Maximize / Minimize Canvas */}
          <button
            type="button"
            onClick={() => setIsCanvasMaximized(!isCanvasMaximized)}
            className="absolute right-4 top-4 z-10 rounded-lg border border-line bg-surface p-2 text-text-muted hover:text-text-strong shadow-md hover:shadow-lg transition-all"
            aria-label={isCanvasMaximized ? "Restaurar canvas" : "Maximizar canvas"}
            title={isCanvasMaximized ? "Restaurar pantalla" : "Pantalla completa"}
          >
            {isCanvasMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>

          {/* Expand Left Sidebar Trigger */}
          {!isCanvasMaximized && !isLeftSidebarOpen && (
            <button
              type="button"
              onClick={() => setIsLeftSidebarOpen(true)}
              className="absolute left-4 top-4 z-10 rounded-lg border border-line bg-surface p-2 text-text-muted hover:text-text-strong shadow-md hover:shadow-lg transition-all"
              aria-label="Mostrar panel izquierdo"
              title="Mostrar panel izquierdo"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          {/* Expand Right Sidebar Trigger */}
          {project && !isCanvasMaximized && !isRightSidebarOpen && (
            <button
              type="button"
              onClick={() => setIsRightSidebarOpen(true)}
              className="absolute right-4 top-16 z-10 rounded-lg border border-line bg-surface p-2 text-text-muted hover:text-text-strong shadow-md hover:shadow-lg transition-all"
              aria-label="Mostrar panel de logs"
              title="Mostrar panel de logs"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}

          {/* Continuity Chat Box */}
          {project && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
              <form 
                className="relative flex items-center bg-surface border border-line shadow-2xl rounded-2xl overflow-hidden focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 transition-all"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!chatMessage.trim() || isChatSending) return;
                  setIsChatSending(true);
                  try {
                    await sendChat(project.id, chatMessage);
                    setChatMessage("");
                  } finally {
                    setIsChatSending(false);
                  }
                }}
              >
                <input
                  type="text"
                  placeholder="Itera en este proyecto: solicita cambios, mejoras o correcciones..."
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  disabled={isChatSending || project.status === "failed"}
                  className="w-full bg-transparent px-5 py-4 outline-none text-sm text-text-strong placeholder:text-text-muted disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!chatMessage.trim() || isChatSending || project.status === "failed"}
                  className={`mr-2 p-2 rounded-xl flex items-center justify-center transition-all duration-300 ${chatMessage.trim() ? 'bg-brand text-white hover:bg-brand/90 hover:scale-105 shadow-md hover:shadow-lg' : 'bg-[var(--surface-muted)] text-[var(--text-muted)] cursor-not-allowed'}`}
                  title="Enviar instrucción"
                >
                  {isChatSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowUp className="h-5 w-5" />}
                </button>
              </form>
            </div>
          )}
        </div>
      </section>

      {project && !isCanvasMaximized && isRightSidebarOpen ? (
        <aside className="border-l border-line bg-surface p-4 overflow-y-auto scroll-mask-y">
          <div className="flex items-center justify-between mb-4">
            <SectionTitle icon={<FileText className="h-4 w-4" />} title={t.artifactsControl} />
            <button
              type="button"
              onClick={() => setIsRightSidebarOpen(false)}
              className="p-1.5 rounded-md hover:bg-surface-muted text-text-muted hover:text-text-strong transition"
              title="Ocultar panel"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

        {project?.status === "waiting_intervention" ? (
          <div className="my-4 rounded-lg border border-amber-500 bg-amber-500/10 p-3.5 shadow-sm">
            <div className="text-sm font-bold text-amber-500 flex items-center gap-1.5 animate-pulse">
              ⚠️ Intervención Humana Requerida
            </div>
            <p className="mt-1.5 text-xs text-text-muted leading-relaxed">
              El flujo se ha pausado debido a un fallo en un agente. Corrige el problema o las variables de entorno y presiona continuar.
            </p>
            {(() => {
              const failedPhase = Object.values(project.phases).find(p => p.status === 'failed' || p.error);
              if (!failedPhase) return null;
              return (
                <div className="mt-2.5 rounded bg-black/20 dark:bg-black/40 border border-line p-2 text-[10px] font-mono text-rose-450 max-h-32 overflow-y-auto leading-normal">
                  Fase: {failedPhase.id}<br/>
                  Error: {failedPhase.error}
                </div>
              );
            })()}
            <div className="mt-3 flex gap-2">
              <button
                onClick={async () => {
                  if (project) {
                    await retryProject(project.id);
                  }
                }}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 px-3.5 py-2 text-xs font-bold text-white active:scale-95 transition"
              >
                Continuar y Reintentar
              </button>
            </div>
          </div>
        ) : null}

        {project?.status === "waiting_approval" ? (
          <div className="my-4 rounded-lg border border-amber-300 bg-amber-50/50 p-3">
            <div className="text-sm font-semibold text-amber-900">{t.pendingContract}</div>
            <p className="mt-1 text-xs text-amber-800 leading-relaxed">
              {t.contractPendingDesc}
            </p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => approveContract(true, "Approved from dashboard")}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white active:scale-95 transition"
              >
                {t.approve}
              </button>
              <button
                onClick={() => approveContract(false, "Rejected from dashboard")}
                className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white active:scale-95 transition"
              >
                {t.reject}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 space-y-3">
          {(project?.artifacts || []).slice(0, 8).map((artifact) => {
            const agentDetails = agents[artifact.agent] || {};
            const agentLabel = agentDetails.name || artifact.agent;
            const avatarUrl = agentDetails.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentLabel}`;
            const summary = typeof artifact.content?.summary === "string" ? artifact.content.summary : null;
            return (
              <article 
                key={artifact.id} 
                onClick={() => { setSelectedArtifact(artifact); setShowRawJson(false); }}
                className="quiet-card p-4 cursor-pointer hover:border-[var(--line-strong)] hover:shadow-md transition-all duration-300 group"
              >
                <div className="flex items-center gap-3">
                  <img src={avatarUrl} className="w-8 h-8 rounded-full border border-line bg-surface-muted object-cover" alt="" />
                  <div>
                    <div className="text-sm font-bold text-text-strong group-hover:text-brand transition">{artifact.title}</div>
                    <div className="text-[10px] text-[var(--text-muted)] font-bold">
                      {agentLabel} · {artifact.type}
                    </div>
                  </div>
                </div>
                {summary && (
                  <p className="mt-2 text-xs text-text-muted line-clamp-2 leading-relaxed">
                    {summary}
                  </p>
                )}
                <div className="mt-2.5 text-[10px] font-bold text-brand flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  {t.viewEnriched} &rarr;
                </div>
              </article>
            );
          })}
        </div>

        {project?.status === "running" && project.current_phase && streamBuffers[project.current_phase] && (
          <div className="mt-6 border border-brand/50 bg-brand/5 p-4 rounded-lg">
            <h4 className="text-xs font-bold uppercase text-brand mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-brand animate-ping"></span>
              Streaming {project.current_phase.replaceAll("_", " ")}...
            </h4>
            <div className="text-xs font-mono text-text-strong whitespace-pre-wrap max-h-64 overflow-y-auto">
              {streamBuffers[project.current_phase]}
            </div>
          </div>
        )}

        <div className="mt-6">
          <SectionTitle icon={<ShieldCheck className="h-4 w-4" />} title={t.activity} />
          <div className="mt-3 space-y-2">
            {(project?.logs || []).slice(0, 12).map((log) => (
              <div key={log.id} className="rounded-lg bg-[var(--surface-muted)] p-2.5 text-xs border border-line shadow-sm">
                <div className="font-semibold text-text-strong">{agents[log.agent]?.name || log.agent}</div>
                <div className="text-[var(--text-muted)] leading-relaxed mt-0.5 font-medium max-h-32 overflow-y-auto font-mono whitespace-pre-wrap pr-1">{log.message}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
      ) : null}

      {/* Slide-over panel for artifact details */}
      {selectedArtifact && (() => {
        const agentDetails = agents[selectedArtifact.agent] || {};
        const agentLabel = agentDetails.name || selectedArtifact.agent;
        const avatarUrl = agentDetails.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentLabel}`;
        const content = selectedArtifact.content || {};
        const summary = asString(content.summary);
        const deliverables = asRecord(content.deliverables);
        const risks = asStringArray(content.risks);
        const nextRequiredInputs = asStringArray(content.next_required_inputs);
        
        return (
          <div className="absolute inset-y-0 right-0 z-20 w-full border-l border-line bg-surface shadow-2xl flex flex-col fade-in sm:w-[min(620px,calc(100vw-2rem))]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <img src={avatarUrl} className="w-10 h-10 rounded-full border border-line bg-surface-muted object-cover" alt="" />
                <div>
                  <h3 className="text-base font-bold text-text-strong">{selectedArtifact.title}</h3>
                  <div className="text-xs text-[var(--text-muted)] font-semibold">
                    {agentLabel} ({agentDetails.display_name || "Agent"})
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setPhaseToRollback(selectedArtifact.type);
                  }}
                  className="p-1.5 px-3 rounded-lg border border-line bg-surface text-danger hover:bg-danger/10 transition text-xs font-bold"
                  title="Revertir y reintentar esta fase"
                >
                  Rollback
                </button>
                <button 
                  onClick={() => setSelectedArtifact(null)}
                  className="p-1.5 rounded-lg border border-line bg-surface text-text-muted hover:text-text-strong hover:shadow-sm transition active:scale-95"
                  aria-label="Cerrar detalle de artefacto"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tabs & Content */}
            <div className="flex border-b border-line bg-surface-muted/50 px-6 flex-shrink-0">
              <button 
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition ${!showRawJson ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-strong'}`}
                onClick={() => setShowRawJson(false)}
              >
                {t.formattedDeliverable}
              </button>
              <button 
                className={`py-2.5 px-4 text-xs font-bold border-b-2 transition ${showRawJson ? 'border-brand text-brand' : 'border-transparent text-text-muted hover:text-text-strong'}`}
                onClick={() => setShowRawJson(true)}
              >
                {t.rawJson}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 scroll-mask-y">
              {showRawJson ? (
                <pre className="rounded-lg bg-gray-950 p-4 text-xs text-gray-200 font-mono shadow-inner overflow-auto h-full max-h-[70vh]">
                  {JSON.stringify(content, null, 2)}
                </pre>
              ) : (
                <div className="space-y-6">
                  {/* Summary */}
                  {summary && (
                    <div className="rounded-lg bg-brand/5 border border-brand/20 p-4 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand mb-1.5">{t.phaseSummary}</h4>
                      <p className="text-sm text-text-strong font-normal leading-relaxed">{summary}</p>
                    </div>
                  )}

                  {/* Deliverables */}
                  {deliverables && (
                    <div className="space-y-6">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-text-muted border-b border-line pb-1">{t.generatedDeliverables}</h4>
                      {Object.entries(deliverables).map(([key, val]) => (
                        <div key={key} className="rounded-lg border border-line bg-surface-muted/10 p-4 shadow-sm space-y-3">
                          <div className="flex justify-between items-center">
                            <h5 className="text-sm font-bold text-text-strong uppercase tracking-wide flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full bg-brand"></span>
                              {key.replaceAll("_", " ")}
                            </h5>
                            {typeof val === 'string' && (
                              <button 
                                onClick={() => {
                                  const printWindow = window.open('', '', 'width=800,height=600');
                                  if (printWindow) {
                                    printWindow.document.write(`
                                      <html>
                                        <head>
                                          <title>${key.replaceAll("_", " ")}</title>
                                          <style>
                                            body { font-family: sans-serif; padding: 20px; line-height: 1.6; color: #333; }
                                            h1, h2, h3 { color: #111; }
                                            pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
                                            code { background: #f4f4f4; padding: 2px 4px; }
                                          </style>
                                        </head>
                                        <body>
                                          ${document.getElementById(`deliverable-${key}`)?.innerHTML || ''}
                                        </body>
                                      </html>
                                    `);
                                    printWindow.document.close();
                                    printWindow.focus();
                                    setTimeout(() => {
                                      printWindow.print();
                                      printWindow.close();
                                    }, 250);
                                  }
                                }}
                                className="text-xs font-bold text-brand hover:underline flex items-center gap-1 bg-brand/10 px-2 py-1 rounded-md"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                Descargar PDF
                              </button>
                            )}
                          </div>
                          <div id={`deliverable-${key}`} className="bg-surface border border-line rounded-lg p-4 shadow-inner max-h-[450px] overflow-y-auto">
                            {typeof val === 'string' ? (
                              <MarkdownRenderer text={
                                (function(text) {
                                  const trimmed = text.trim();
                                  if (trimmed.startsWith("```markdown")) {
                                    return trimmed.substring(11).replace(/```$/, "").trim();
                                  }
                                  if (trimmed.startsWith("```\n")) {
                                    return trimmed.substring(4).replace(/```$/, "").trim();
                                  }
                                  return text;
                                })(val)
                              } />
                            ) : (
                              <pre className="text-xs font-mono text-text-muted overflow-auto">{JSON.stringify(val, null, 2)}</pre>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Risks */}
                  {risks.length > 0 && (
                    <div className="rounded-lg bg-danger/5 border border-danger/20 p-4 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-danger mb-2">{t.risksAndBlocks}</h4>
                      <ul className="list-disc list-inside space-y-1.5 text-sm text-text-strong font-semibold">
                        {risks.map((risk, idx) => (
                          <li key={idx} className="leading-relaxed">{risk}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Next Inputs */}
                  {nextRequiredInputs.length > 0 && (
                    <div className="rounded-lg bg-info/5 border border-info/20 p-4 shadow-sm">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-info mb-2">{t.inputsAndNext}</h4>
                      <ul className="list-disc list-inside space-y-1.5 text-sm text-text-strong font-semibold">
                        {nextRequiredInputs.map((inp, idx) => (
                          <li key={idx} className="leading-relaxed">{inp}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      <AnimatePresence>
        {phaseToRollback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-surface border border-line rounded-xl shadow-2xl p-6 max-w-md w-full relative"
            >
              <h3 className="text-lg font-bold text-text-strong mb-2">Confirmar Rollback</h3>
              <p className="text-sm text-text-muted mb-6">
                ¿Seguro que deseas revertir la fase <strong>{phaseToRollback.replaceAll("_", " ")}</strong>? 
                Se borrarán sus artefactos, se reiniciarán las dependencias y el proyecto se reanudará desde este punto.
              </p>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setPhaseToRollback(null)}
                  className="px-4 py-2 rounded-lg font-medium text-sm text-text-muted hover:text-text-strong hover:bg-surface-muted transition"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (project) rollbackPhase(project.id, phaseToRollback);
                    setPhaseToRollback(null);
                    setSelectedArtifact(null);
                  }}
                  className="px-4 py-2 rounded-lg font-bold text-sm bg-danger text-white hover:bg-danger/90 transition shadow-sm"
                >
                  Confirmar y Revertir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function Metric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="quiet-card flex items-center justify-between p-3">
      <div>
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-brand">{icon}</div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon?: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-sm font-semibold">
      {icon}
      {title}
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      {label}
      <input
        className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand shadow-sm placeholder:text-text-muted/60"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  minHeight,
  placeholder
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      {label}
      <textarea
        className={`mt-1 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand shadow-sm placeholder:text-text-muted/60 ${minHeight || "min-h-[80px]"}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}
