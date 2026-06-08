"use client";

declare global {
  interface Window {
    __TAURI__?: {
      window: {
        getCurrentWindow: () => any;
      };
    };
  }
}

import { FormEvent, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MaterialIcon } from "../components/MaterialIcon";
import { AgentSettings } from "../components/AgentSettings";
import { DepartmentSettings } from "../components/DepartmentSettings";
import { ProviderSettings } from "../components/ProviderSettings";
import { McpSettings } from "../components/McpSettings";
import { OrgChart } from "../components/OrgChart";
import { SkillsSettings } from "../components/SkillsSettings";
import { DeliverablesSettings } from "../components/DeliverablesSettings";
import { SettingsPanel } from "../components/SettingsPanel";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "../components/ui/tooltip";
import { WorkspaceView } from "../components/WorkspaceView";
import { FactoryView } from "../components/FactoryView";
import { InitialSetupStepper } from "../components/InitialSetupStepper";
import { SidebarMetric as Metric } from "../components/SidebarMetric";
import { useOrchestrator } from "../hooks/useOrchestrator";
type View = "factory" | "workspace" | "org" | "departments" | "agents" | "providers" | "mcp" | "skills" | "deliverables" | "settings";

const navItems = [
  { id: "factory" as const, icon: "dashboard" },
  { id: "workspace" as const, icon: "folder_open" },
  { id: "org" as const, icon: "corporate_fare" },
  { id: "departments" as const, icon: "account_tree" },
  { id: "agents" as const, icon: "smart_toy" },
  { id: "providers" as const, icon: "power" },
  { id: "skills" as const, icon: "auto_stories" },
  { id: "deliverables" as const, icon: "description" },
  { id: "mcp" as const, icon: "extension" },
  { id: "settings" as const, icon: "settings" }
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
    projectTraces,
    projectUsage,
    toolApprovals,
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
    createDepartment,
    updateDepartment,
    deleteDepartment,
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
    decideToolApproval,
    apiBase
  } = useOrchestrator();

  const lang = settings?.language || "en";
  const loc = localization[lang as "en" | "es"] || localization.en;

  const [view, setView] = useState<View>("factory");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

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
  const showInitialSetup = Boolean(settings && agentRegistry && mcpCatalog && projects.length === 0);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden border border-line bg-background transition-colors duration-200">
      <AnimatePresence>
        {showSplash && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-black"
          >
            <img 
              src="/splash_dark.png" 
              className="hidden dark:block w-auto h-auto max-w-[30%] max-h-[30%] object-contain" 
              alt="Loading..."
            />
            <img 
              src="/splash_light.png" 
              className="block dark:hidden w-auto h-auto max-w-[30%] max-h-[30%] object-contain" 
              alt="Loading..."
            />
          </motion.div>
        )}
      </AnimatePresence>
      {/* Custom Titlebar */}
      <div 
        data-tauri-drag-region 
        className="flex items-center justify-between h-[30px] bg-background select-none flex-shrink-0 z-50 w-full relative"
      >
        <div data-tauri-drag-region className="flex-1 h-full flex items-center px-3">
          {/* Drag area spacer */}
        </div>
        <div className="flex items-center">
          <button 
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.__TAURI__) {
                window.__TAURI__.window.getCurrentWindow().minimize();
              }
            }}
            className="w-11 h-[30px] flex items-center justify-center hover:bg-surface-muted transition-colors text-text-muted hover:text-text-strong"
            title="Minimize"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="1" y1="5" x2="9" y2="5" />
            </svg>
          </button>
          <button 
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.__TAURI__) {
                window.__TAURI__.window.getCurrentWindow().toggleMaximize();
              }
            }}
            className="w-11 h-[30px] flex items-center justify-center hover:bg-surface-muted transition-colors text-text-muted hover:text-text-strong"
            title="Maximize"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <rect x="1.5" y="1.5" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button 
            type="button"
            onClick={() => {
              if (typeof window !== "undefined" && window.__TAURI__) {
                window.__TAURI__.window.getCurrentWindow().close();
              }
            }}
            className="w-11 h-[30px] flex items-center justify-center hover:bg-danger hover:text-white transition-colors text-text-muted"
            title="Close"
          >
            <svg className="w-2.5 h-2.5" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2">
              <line x1="1.5" y1="1.5" x2="8.5" y2="8.5" />
              <line x1="8.5" y1="1.5" x2="1.5" y2="8.5" />
            </svg>
          </button>
        </div>
        {/* Gradient border bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-line to-transparent" />
      </div>

      <main className="app-shell desktop-shell transition-colors duration-200 flex flex-1 min-h-0 relative">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed left-0 top-0 z-50 flex h-full flex-col border-r border-line bg-surface pt-0 px-3 pb-3 transition-all duration-300 flex-shrink-0 overflow-visible md:sticky ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-[calc(100%+24px)] md:translate-x-0'} ${isSidebarOpen ? 'md:w-[280px]' : 'md:w-[80px]'}`}>
        {/* Toggle Button on the right border */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-4 z-[60] flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-text-muted shadow-sm transition hover:bg-surface-muted hover:text-text-strong"
          aria-label={isSidebarOpen ? "Colapsar sidebar" : "Expandir sidebar"}
          title={isSidebarOpen ? "Colapsar sidebar" : "Expandir sidebar"}
        >
          <MaterialIcon name="chevron_left" className={`w-4 transition-transform ${!isSidebarOpen && 'rotate-180'}`} />
        </button>

        <div className="flex items-center gap-2.5 px-2 border-b border-line h-[56px] overflow-hidden flex-shrink-0">
          <img 
            src={settings?.logo_brand || "/logo.png"} 
            className="w-9 h-9 rounded-xl object-fill flex-shrink-0" 
            alt="Brand Logo" 
          />
          {isSidebarOpen && (
            <div className="flex flex-col min-w-0 transition-opacity duration-300">
              <span className="text-sm font-bold text-text-strong truncate">
                {settings?.company_name || "DevFoundry"}
              </span>
              <span className="text-[10px] text-text-muted truncate">
                {settings?.company_subtitle || "AI Software Company"}
              </span>
            </div>
          )}
        </div>

        <nav className="mt-2 pt-4 space-y-2 flex-1 overflow-y-auto scroll-mask-y pr-2 pb-4 overflow-x-hidden">
          <TooltipProvider delayDuration={0}>
            {navItems.map((item) => {
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
                      <MaterialIcon name={item.icon} className="w-4 flex-shrink-0" />
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
          <Metric label={loc.metricAgents} value={String(totalAgents)} icon={<MaterialIcon name="smart_toy" className="w-4" />} />
          <Metric label={loc.metricMcps} value={String(activeMcps)} icon={<MaterialIcon name="widgets" className="w-4" />} />
          <Metric label={loc.metricPhases} value={`${completedPhases}/${totalPhases}`} icon={<MaterialIcon name="check_circle" className="w-4" />} />
        </div>


      </aside>

      <section className="desktop-content min-w-0 flex flex-col h-full flex-1 relative overflow-hidden bg-surface">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/86 px-4 md:px-6 h-[56px] flex items-center backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center">
              <button 
                className="md:hidden p-2 -ml-2 text-text-muted hover:text-text-strong rounded-lg hover:bg-surface-muted transition-colors"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menu principal"
              >
                <MaterialIcon name="menu" className="w-5" />
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 md:px-3 py-1.5 text-xs font-semibold text-text-muted shadow-sm">
              <MaterialIcon name="alt_route" className="w-3.5" />
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
              className="absolute inset-0 overflow-hidden"
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
                  mcpSecrets={mcpSecrets}
                  streamBuffers={streamBuffers}
                  projectTraces={projectTraces}
                  projectUsage={projectUsage}
                  toolApprovals={toolApprovals}
                  decideToolApproval={decideToolApproval}
                  settings={settings}
                  updateSettings={updateSettings}
                  language={lang}
                  theme={settings?.theme || "dark"}
                />
              )}

              {view === "workspace" && (
                <WorkspaceView
                  data={workspace}
                  apiBase={apiBase}
                  theme={settings?.theme || "dark"}
                  refreshWorkspace={refreshWorkspace}
                  projects={projects}
                  language={lang}
                />
              )}

              {view === "org" && <OrgChart registry={agentRegistry} departmentRegistry={departmentRegistry} />}

              {view === "departments" && (
                <DepartmentSettings
                  departmentRegistry={departmentRegistry}
                  createDepartment={createDepartment}
                  updateDepartment={updateDepartment}
                  deleteDepartment={deleteDepartment}
                  error={error}
                />
              )}

              {view === "agents" && (
                <AgentSettings 
                  registry={agentRegistry} 
                  departmentRegistry={departmentRegistry}
                  allSkills={skills}
                  allDeliverables={deliverables}
                  mcpCatalog={mcpCatalog}
                  onSave={updateAgent} 
                  onCreateAgent={createAgent} 
                />
              )}

              {view === "providers" && (
                <ProviderSettings
                  mcpSecrets={mcpSecrets}
                  saveMcpSecret={saveMcpSecret}
                  error={error}
                />
              )}

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
          {showInitialSetup ? (
            <InitialSetupStepper
              activeView={view}
              agents={agentRegistry}
              catalog={mcpCatalog}
              secrets={mcpSecrets}
              language={lang}
              onSelectView={(nextView) => handleSetView(nextView)}
            />
          ) : null}
        </div>
      </section>
    </main>
    </div>
  );
}
