"use client";

import { MaterialIcon } from "./MaterialIcon";
import type { AgentRegistry, McpCatalog, McpSecretsResponse } from "../hooks/useOrchestrator";

type SetupView = "factory" | "providers" | "mcp" | "org" | "agents";

type Props = {
  activeView: SetupView | string;
  agents: AgentRegistry | null;
  catalog: McpCatalog | null;
  secrets: McpSecretsResponse | null;
  onSelectView: (view: SetupView) => void;
  language: string;
};

type SetupStep = {
  key: string;
  view: SetupView;
  icon: string;
  title: string;
  detail: string;
  status: string;
  complete: boolean;
};

export function InitialSetupStepper({ activeView, agents, catalog, secrets, onSelectView, language }: Props) {
  const copy = language === "es" ? esCopy : enCopy;
  const configuredSecrets = Object.values(secrets?.secrets || {}).filter((secret) => secret.configured).length;
  const missingSecrets = Object.values(secrets?.secrets || {}).filter((secret) => !secret.configured).length;
  const activeMcps = Object.values(catalog?.servers || {}).filter((server) => server.enabled).length;
  const agentCount = Object.keys(agents?.agents || {}).length;
  const steps: SetupStep[] = [
    {
      key: "database",
      view: "factory",
      icon: "database",
      title: copy.database,
      detail: copy.databaseDetail,
      status: copy.ready,
      complete: true,
    },
    {
      key: "providers",
      view: "providers",
      icon: "key",
      title: copy.providers,
      detail: copy.providersDetail,
      status: configuredSecrets ? `${configuredSecrets} ${copy.configured}` : copy.review,
      complete: configuredSecrets > 0,
    },
    {
      key: "mcp",
      view: "mcp",
      icon: "extension",
      title: copy.mcp,
      detail: copy.mcpDetail,
      status: `${activeMcps} ${copy.active}`,
      complete: activeMcps > 0 && missingSecrets === 0,
    },
    {
      key: "team",
      view: "org",
      icon: "groups",
      title: copy.team,
      detail: copy.teamDetail,
      status: `${agentCount} ${copy.agents}`,
      complete: agentCount > 0,
    },
    {
      key: "firstProject",
      view: "factory",
      icon: "rocket_launch",
      title: copy.firstProject,
      detail: copy.firstProjectDetail,
      status: copy.pending,
      complete: false,
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-4 bottom-4 z-30 flex justify-center">
      <div className="pointer-events-auto w-full max-w-4xl rounded-2xl border border-line bg-surface/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="grid gap-2 md:grid-cols-5">
          {steps.map((step, index) => {
            const selected = activeView === step.view && (step.view !== "factory" || index === 0);
            return (
              <button
                key={step.key}
                type="button"
                onClick={() => onSelectView(step.view)}
                className={`min-w-0 rounded-xl border px-3 py-2 text-left transition ${
                  selected
                    ? "border-brand bg-brand/10 text-text-strong"
                    : "border-transparent bg-surface-muted/40 text-text-muted hover:border-line hover:bg-surface"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.complete ? "bg-success/10 text-success" : "bg-brand/10 text-brand"}`}>
                    <MaterialIcon name={step.complete ? "check" : step.icon} className="w-4" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black uppercase tracking-normal">{step.title}</div>
                    <div className="truncate text-[10px] font-semibold text-text-muted">{step.status}</div>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-text-muted">{step.detail}</p>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {steps.map((step, index) => (
            <button
              key={`${step.key}-dot`}
              type="button"
              onClick={() => onSelectView(step.view)}
              className={`h-2 rounded-full transition-all ${
                (activeView === step.view && (step.view !== "factory" || index === 0))
                  ? "w-6 bg-brand"
                  : step.complete
                    ? "w-2 bg-success"
                    : "w-2 bg-line-strong"
              }`}
              aria-label={step.title}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const esCopy = {
  database: "Base de datos",
  databaseDetail: "La base esta vacia. Esta es la pantalla de arranque para preparar la empresa antes del primer proyecto.",
  providers: "Providers",
  providersDetail: "Confirma llaves de modelos y credenciales necesarias para que los agentes puedan generar artefactos reales.",
  mcp: "MCP",
  mcpDetail: "Revisa servidores activos y secretos requeridos. No se reinicia tu catalogo MCP ni providers.",
  team: "Equipo",
  teamDetail: "Valida agentes, departamentos, skills, entregables y jerarquia operativa.",
  firstProject: "Primer proyecto",
  firstProjectDetail: "Cuando la configuracion este lista, crea el primer proyecto desde la fabrica.",
  ready: "lista",
  review: "revisar",
  configured: "configurados",
  active: "activos",
  agents: "agentes",
  pending: "pendiente",
};

const enCopy = {
  database: "Database",
  databaseDetail: "The database is empty. This startup flow prepares the company before the first project.",
  providers: "Providers",
  providersDetail: "Confirm model keys and credentials so agents can produce real artifacts.",
  mcp: "MCP",
  mcpDetail: "Review active servers and required secrets. Your MCP catalog and providers are not reset.",
  team: "Team",
  teamDetail: "Validate agents, departments, skills, deliverables and reporting structure.",
  firstProject: "First project",
  firstProjectDetail: "When configuration is ready, create the first project from the factory.",
  ready: "ready",
  review: "review",
  configured: "configured",
  active: "active",
  agents: "agents",
  pending: "pending",
};
