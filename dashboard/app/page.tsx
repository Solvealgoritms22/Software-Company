"use client";

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
    <main className="app-shell desktop-shell transition-colors duration-200 flex">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed left-3 top-3 z-50 flex h-[calc(100vh-24px)] flex-col rounded-[22px] border border-line bg-surface/90 p-3 shadow-sm backdrop-blur-xl transition-all duration-300 flex-shrink-0 overflow-hidden md:sticky ${isMobileMenuOpen ? 'translate-x-0 w-[280px]' : '-translate-x-[calc(100%+24px)] md:translate-x-0'} ${isSidebarOpen ? 'md:w-[280px]' : 'md:w-[80px]'}`}>
        <div className={`flex items-center p-2 relative ${isSidebarOpen ? 'justify-end' : 'justify-center'} min-h-[44px]`}>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="rounded-xl border border-line bg-surface p-2 text-text-muted shadow-sm transition hover:bg-surface-muted hover:text-text-strong"
            aria-label={isSidebarOpen ? "Colapsar sidebar" : "Expandir sidebar"}
            title={isSidebarOpen ? "Colapsar sidebar" : "Expandir sidebar"}
          >
            <MaterialIcon name="chevron_left" className={`w-4 transition-transform ${!isSidebarOpen && 'rotate-180'}`} />
          </button>
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

      <section className="desktop-content min-w-0 flex flex-col h-[calc(100vh-24px)] flex-1 relative overflow-hidden rounded-[22px] border border-line bg-surface shadow-sm">
        <header className="sticky top-0 z-10 border-b border-line bg-surface/86 px-4 md:px-6 py-3 md:py-4 backdrop-blur-xl flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                className="md:hidden p-2 -ml-2 text-text-muted hover:text-text-strong rounded-lg hover:bg-surface-muted transition-colors"
                onClick={() => setIsMobileMenuOpen(true)}
                aria-label="Abrir menu principal"
              >
                <MaterialIcon name="menu" className="w-5" />
              </button>
              <div>
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-text-strong">{title}</h1>
                <p className="mt-0.5 md:mt-1 text-xs text-text-muted hidden sm:block">{subtitle}</p>
              </div>
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
  );
}
