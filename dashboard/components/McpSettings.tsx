"use client";

import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Blocks,
  Bot,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Cloud,
  Code2,
  Copy,
  Database,
  ExternalLink,
  FileSearch,
  Globe,
  KeyRound,
  Lock,
  Plus,
  Power,
  Save,
  Search,
  ShieldCheck,
  Terminal,
  Trash2,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { prism } from "react-syntax-highlighter/dist/esm/styles/prism";
import { SiConfluence, SiGithub, SiGoogledrive, SiJira, SiVercel } from "react-icons/si";

import type { AgentRegistry, McpCatalog, McpSecretsResponse } from "../hooks/useOrchestrator";

type Props = {
  catalog: McpCatalog | null;
  exported: Record<string, unknown> | null;
  secrets: McpSecretsResponse | null;
  registry: AgentRegistry | null;
  onToggle: (name: string) => void | Promise<void>;
  onSave: (name: string, payload: Record<string, unknown>) => void | Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onDeleteSecret: (key: string) => Promise<void>;
  onExport: (client: string) => void | Promise<void>;
};

type ServerItem = McpCatalog["servers"][string] & { name: string };

const EXPORT_CLIENTS = [
  { id: "codex", label: "Codex" },
  { id: "vscode", label: "VS Code" },
  { id: "cursor", label: "Cursor" },
  { id: "claude", label: "Claude" },
];

const MCP_LOGOS: Record<string, string> = {
  github_mcp: "https://cdn.simpleicons.org/github",
  jira_mcp: "https://cdn.simpleicons.org/jira",
  confluence_mcp: "https://cdn.simpleicons.org/confluence",
  google_drive_mcp: "https://cdn.simpleicons.org/googledrive",
  deploy_mcp: "https://cdn.simpleicons.org/vercel",
  playwright_mcp: "https://playwright.dev/img/playwright-logo.svg",
  security_mcp: "https://cdn.simpleicons.org/owasp",
  shadcn_mcp: "https://ui.shadcn.com/favicon.ico",
  context7_mcp: "https://context7.com/favicon.ico",
  slack_mcp: "https://cdn.simpleicons.org/slack",
  sentry_mcp: "https://cdn.simpleicons.org/sentry",
  aws_mcp: "https://cdn.simpleicons.org/amazonwebservices",
  brave_search_mcp: "https://cdn.simpleicons.org/brave",
  puppeteer_mcp: "https://cdn.simpleicons.org/puppeteer",
  postgres_mcp: "https://cdn.simpleicons.org/postgresql",
  sqlite_mcp: "https://cdn.simpleicons.org/sqlite",
};

export function McpSettings({
  catalog,
  exported,
  secrets,
  registry,
  onToggle,
  onSave,
  onSaveSecret,
  onDeleteSecret,
  onExport,
}: Props) {
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [secretDrafts, setSecretDrafts] = useState<Record<string, string>>({});
  const [savingSecret, setSavingSecret] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("custom");
  const [newCommand, setNewCommand] = useState("npx");
  const [newArgs, setNewArgs] = useState("-y package-name");
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const servers = catalog?.servers || {};
  const selectedServer = selected ? servers[selected] : null;
  const agents = registry?.agents || {};

  useEffect(() => {
    if (selectedServer) {
      setSelectedAgents(selectedServer.required_for || []);
    } else {
      setSelectedAgents([]);
    }
  }, [selected, selectedServer]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelected(null);
        setIsAddModalOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const serversList = useMemo<ServerItem[]>(() => {
    const list = Object.entries(servers).map(([name, server]) => ({ name, ...server }));
    const query = searchQuery.trim().toLowerCase();
    if (!query) return list;
    return list.filter((server) =>
      [
        server.name,
        server.display_name,
        server.description,
        server.category,
        server.command,
        ...(server.required_for || []),
        ...(server.env_keys || []),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [servers, searchQuery]);

  const activeCount = serversList.filter((server) => server.enabled).length;
  const totalSecretRefs = serversList.reduce((total, server) => total + (server.env_keys || []).length, 0);
  const missingSecretRefs = serversList.reduce((total, server) => {
    return total + (server.env_keys || []).filter((key) => !secrets?.secrets?.[key]?.configured).length;
  }, 0);
  const assignedAgents = new Set(serversList.flatMap((server) => server.required_for || [])).size;

  function addServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onSave(name, {
      enabled: false,
      kind: "stdio",
      category: newCategory.trim() || "custom",
      display_name: name,
      description: "Custom MCP registered from dashboard. It remains disabled until a local backend server is implemented.",
      command: newCommand.trim(),
      args: newArgs.split(" ").filter(Boolean),
      required_for: [],
      env_keys: [],
    });
    setSelected(name);
    setNewName("");
    setNewCategory("custom");
    setNewCommand("npx");
    setNewArgs("-y package-name");
    setIsAddModalOpen(false);
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col overflow-hidden bg-background">
      <header className="border-b border-line bg-surface px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
              <Blocks className="h-4 w-4" />
              Tool Runtime
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-strong">MCP Operations Console</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-muted">
              Controla servidores MCP, permisos de agentes, secretos requeridos y exportaciones de clientes sin salir del dashboard.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-4">
            <MetricTile label="Activos" value={`${activeCount}/${serversList.length}`} icon={<Power className="h-4 w-4" />} tone="brand" />
            <MetricTile label="Secretos" value={`${totalSecretRefs - missingSecretRefs}/${totalSecretRefs || 0}`} icon={<KeyRound className="h-4 w-4" />} tone={missingSecretRefs ? "warning" : "success"} />
            <MetricTile label="Agentes" value={String(assignedAgents)} icon={<Users className="h-4 w-4" />} tone="neutral" />
            <MetricTile label="Riesgo" value={missingSecretRefs ? `${missingSecretRefs} faltan` : "OK"} icon={<ShieldCheck className="h-4 w-4" />} tone={missingSecretRefs ? "danger" : "success"} />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b border-line bg-surface-muted/50 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <div className="relative min-w-0 flex-1 md:max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            className="w-full rounded-lg border border-line bg-surface py-2.5 pl-9 pr-3 text-sm text-text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            placeholder="Buscar por servidor, categoría, agente o secreto..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </div>
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-surface transition hover:bg-brand-strong"
        >
          <Plus className="h-4 w-4" />
          Agregar MCP
        </button>
      </div>

      <main className="min-h-0 flex-1 overflow-y-auto p-5 scroll-mask-y">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {serversList.map((server) => (
            <ServerCard
              key={server.name}
              server={server}
              missingSecrets={(server.env_keys || []).filter((key) => !secrets?.secrets?.[key]?.configured).length}
              onConfigure={() => setSelected(server.name)}
              onToggle={() => onToggle(server.name)}
            />
          ))}
        </div>

        {serversList.length === 0 && (
          <div className="mt-10 rounded-lg border border-dashed border-line bg-surface p-8 text-center text-sm text-text-muted">
            No hay MCPs que coincidan con la búsqueda.
          </div>
        )}
      </main>

      {isAddModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => setIsAddModalOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg rounded-xl border border-line bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-mcp-title"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 id="add-mcp-title" className="text-base font-bold text-text-strong">Agregar MCP Custom</h2>
                <p className="mt-0.5 text-xs text-text-muted">Registra un servidor stdio revisado para tus agentes.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-strong"
                aria-label="Cerrar modal"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={addServer} className="space-y-4 p-5">
              <Field label="Nombre" value={newName} onChange={setNewName} placeholder="github_mcp" required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Comando" value={newCommand} onChange={setNewCommand} placeholder="npx" required />
                <Field label="Categoría" value={newCategory} onChange={setNewCategory} placeholder="tools" />
              </div>
              <Field label="Argumentos" value={newArgs} onChange={setNewArgs} placeholder="-y @modelcontextprotocol/server-github" />
              <div className="flex justify-end gap-2 border-t border-line pt-4">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="rounded-lg px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-muted">
                  Cancelar
                </button>
                <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-surface transition hover:bg-brand-strong">
                  Guardar MCP
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && selectedServer && (
        <McpDrawer
          name={selected}
          server={selectedServer}
          agents={agents}
          selectedAgents={selectedAgents}
          setSelectedAgents={setSelectedAgents}
          secrets={secrets}
          secretDrafts={secretDrafts}
          setSecretDrafts={setSecretDrafts}
          savingSecret={savingSecret}
          setSavingSecret={setSavingSecret}
          exported={exported}
          copied={copied}
          setCopied={setCopied}
          onClose={() => setSelected(null)}
          onToggle={() => onToggle(selected)}
          onSave={(payload) => onSave(selected, payload)}
          onSaveSecret={onSaveSecret}
          onDeleteSecret={onDeleteSecret}
          onExport={onExport}
        />
      )}
    </div>
  );
}

function ServerCard({
  server,
  missingSecrets,
  onConfigure,
  onToggle,
}: {
  server: ServerItem;
  missingSecrets: number;
  onConfigure: () => void;
  onToggle: () => void | Promise<void>;
}) {
  const enabled = Boolean(server.enabled);
  const agentCount = (server.required_for || []).length;
  const envCount = (server.env_keys || []).length;

  return (
    <article className="rounded-lg border border-line bg-surface p-4 transition hover:border-line-strong">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ServerIcon name={server.name} category={server.category} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-text-strong">{server.display_name || server.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className={enabled ? "text-success" : "text-text-muted"}>{enabled ? "activo" : "inactivo"}</span>
              <span className="text-text-muted">{server.kind || "stdio"}</span>
              <span className="text-text-muted">{server.category || "custom"}</span>
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={`rounded-md border px-2 py-1 text-[11px] font-bold transition ${
            enabled ? "border-success/30 bg-success/10 text-success" : "border-line bg-surface-muted text-text-muted"
          }`}
          aria-label={`${enabled ? "Desactivar" : "Activar"} ${server.display_name || server.name}`}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-text-muted">
        {server.description || "Servidor MCP custom sin descripción."}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Agentes" value={String(agentCount)} />
        <MiniStat label="Secrets" value={envCount ? `${envCount - missingSecrets}/${envCount}` : "0"} tone={missingSecrets ? "danger" : "neutral"} />
        <MiniStat label="Cmd" value={server.command || server.url ? "set" : "-"} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="min-w-0 truncate font-mono text-[11px] text-text-muted">
          {server.command || server.url || "no command"}
        </div>
        <button
          type="button"
          onClick={onConfigure}
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong transition hover:bg-surface-muted"
        >
          Configurar
        </button>
      </div>
    </article>
  );
}

function McpDrawer({
  name,
  server,
  agents,
  selectedAgents,
  setSelectedAgents,
  secrets,
  secretDrafts,
  setSecretDrafts,
  savingSecret,
  setSavingSecret,
  exported,
  copied,
  setCopied,
  onClose,
  onToggle,
  onSave,
  onSaveSecret,
  onDeleteSecret,
  onExport,
}: {
  name: string;
  server: McpCatalog["servers"][string];
  agents: NonNullable<AgentRegistry["agents"]>;
  selectedAgents: string[];
  setSelectedAgents: (ids: string[]) => void;
  secrets: McpSecretsResponse | null;
  secretDrafts: Record<string, string>;
  setSecretDrafts: Dispatch<SetStateAction<Record<string, string>>>;
  savingSecret: string | null;
  setSavingSecret: (key: string | null) => void;
  exported: Record<string, unknown> | null;
  copied: boolean;
  setCopied: (value: boolean) => void;
  onClose: () => void;
  onToggle: () => void | Promise<void>;
  onSave: (payload: Record<string, unknown>) => void | Promise<void>;
  onSaveSecret: (key: string, value: string) => Promise<void>;
  onDeleteSecret: (key: string) => Promise<void>;
  onExport: (client: string) => void | Promise<void>;
}) {
  const missingSecrets = (server.env_keys || []).filter((key) => !secrets?.secrets?.[key]?.configured);

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40 backdrop-blur-sm" onClick={onClose} role="presentation">
      <div
        className="flex h-full w-full max-w-3xl flex-col border-l border-line bg-surface shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mcp-drawer-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <ServerIcon name={name} category={server.category} />
            <div className="min-w-0">
              <h2 id="mcp-drawer-title" className="truncate text-lg font-bold text-text-strong">{server.display_name || name}</h2>
              <p className="truncate text-xs font-medium text-text-muted">{server.command || server.url || "stdio MCP"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggle}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                server.enabled ? "border-danger/30 bg-danger/10 text-danger" : "border-success/30 bg-success/10 text-success"
              }`}
            >
              <Power className="h-4 w-4" />
              {server.enabled ? "Desactivar" : "Activar"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-muted transition hover:bg-surface-muted hover:text-text-strong" aria-label="Cerrar panel MCP">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 scroll-mask-y">
          <section className="rounded-lg border border-line bg-surface-muted/40 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Tipo" value={server.kind || "stdio"} />
              <Info label="Categoría" value={server.category || "custom"} />
              <Info label="Comando" value={server.command || server.url || "-"} />
              <Info label="Argumentos" value={(server.args || []).join(" ") || "-"} />
            </div>
            {server.description ? <p className="mt-4 text-sm leading-relaxed text-text-muted">{server.description}</p> : null}
          </section>

          <section className="mt-5 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-text-strong">Permisos de agentes</h3>
                <p className="mt-1 text-xs text-text-muted">Solo estos agentes podrán usar herramientas de este servidor.</p>
              </div>
              <span className="rounded-full bg-surface-muted px-2 py-1 text-xs font-bold text-text-muted">{selectedAgents.length} asignados</span>
            </div>
            <div className="mt-4">
              <AgentMultiSelect agents={agents} selectedIds={selectedAgents} onChange={setSelectedAgents} />
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-text-strong">
                  <Lock className="h-4 w-4 text-brand" />
                  Secretos requeridos
                </h3>
                <p className="mt-1 text-xs text-text-muted">Los valores se guardan en el vault local del orquestador.</p>
              </div>
              {missingSecrets.length ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-xs font-bold text-danger">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {missingSecrets.length} faltan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Listo
                </span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              {(server.env_keys || []).map((key) => {
                const status = secrets?.secrets?.[key];
                return (
                  <SecretField
                    key={key}
                    name={key}
                    value={secretDrafts[key] || ""}
                    configured={Boolean(status?.configured)}
                    masked={status?.masked || ""}
                    source={status?.source || "missing"}
                    saving={savingSecret === key}
                    onChange={(value) => setSecretDrafts((current) => ({ ...current, [key]: value }))}
                    onSave={async () => {
                      const value = secretDrafts[key]?.trim();
                      if (!value) return;
                      setSavingSecret(key);
                      await onSaveSecret(key, value);
                      setSecretDrafts((current) => ({ ...current, [key]: "" }));
                      setSavingSecret(null);
                    }}
                    onDelete={async () => {
                      setSavingSecret(key);
                      await onDeleteSecret(key);
                      setSavingSecret(null);
                    }}
                  />
                );
              })}
              {(server.env_keys || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-line bg-surface-muted/40 p-4 text-center text-sm font-medium text-text-muted">
                  Este servidor no declara secretos requeridos.
                </div>
              ) : null}
            </div>
          </section>

          <section className="mt-5 rounded-lg border border-line bg-surface p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 className="text-sm font-bold text-text-strong">Exportar configuración MCP</h3>
                <p className="mt-1 text-xs text-text-muted">Genera configuración compatible para clientes externos.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {EXPORT_CLIENTS.map((client) => (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => onExport(client.id)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong transition hover:bg-surface-muted"
                  >
                    <Code2 className="h-3.5 w-3.5" />
                    {client.label}
                  </button>
                ))}
              </div>
            </div>

            {exported ? (
              <div className="group relative mt-4 max-h-72 overflow-y-auto rounded-lg border border-line bg-surface-muted scroll-mask-y">
                <button
                  type="button"
                  onClick={() => {
                    const text = typeof exported.config_toml === "string" ? exported.config_toml : JSON.stringify(exported, null, 2);
                    navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="absolute right-2 top-2 z-10 rounded-lg border border-line bg-surface p-2 text-text-muted transition hover:text-text-strong"
                  aria-label="Copiar configuración exportada"
                >
                  {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
                <SyntaxHighlighter
                  language={typeof exported.config_toml === "string" ? "toml" : "json"}
                  style={prism}
                  customStyle={{ margin: 0, padding: "1.25rem", fontSize: "0.78rem", background: "transparent" }}
                >
                  {typeof exported.config_toml === "string" ? exported.config_toml : JSON.stringify(exported, null, 2)}
                </SyntaxHighlighter>
              </div>
            ) : null}
          </section>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-surface px-5 py-4">
          {server.docs_url ? (
            <a href={server.docs_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-xs font-bold text-brand hover:underline">
              <ExternalLink className="h-4 w-4" />
              Documentación
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={() => onSave({ ...server, required_for: selectedAgents })}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-surface transition hover:bg-brand-strong"
          >
            <Save className="h-4 w-4" />
            Guardar configuración
          </button>
        </div>
      </div>
    </div>
  );
}

function ServerIcon({ name, category }: { name: string; category?: string }) {
  const lower = `${name} ${category || ""}`.toLowerCase();
  const className = "h-5 w-5";
  const logoUrl = MCP_LOGOS[name];
  let icon = <Wrench className={className} />;
  if (lower.includes("github")) icon = <SiGithub className={className} />;
  else if (lower.includes("jira")) icon = <SiJira className={className} />;
  else if (lower.includes("confluence")) icon = <SiConfluence className={className} />;
  else if (lower.includes("drive")) icon = <SiGoogledrive className={className} />;
  else if (lower.includes("deploy") || lower.includes("vercel")) icon = <SiVercel className={className} />;
  else if (lower.includes("database") || lower.includes("postgres") || lower.includes("sqlite")) icon = <Database className={className} />;
  else if (lower.includes("security")) icon = <ShieldCheck className={className} />;
  else if (lower.includes("playwright") || lower.includes("puppeteer")) icon = <FileSearch className={className} />;
  else if (lower.includes("workspace") || lower.includes("filesystem")) icon = <Terminal className={className} />;
  else if (lower.includes("memory") || lower.includes("knowledge")) icon = <BrainCircuit className={className} />;
  else if (lower.includes("fetch") || lower.includes("brave")) icon = <Globe className={className} />;
  else if (lower.includes("aws") || lower.includes("cloud")) icon = <Cloud className={className} />;
  else if (lower.includes("agent")) icon = <Bot className={className} />;

  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted text-brand">
      {logoUrl ? (
        <img
          src={logoUrl}
          className="h-5 w-5 object-contain"
          alt=""
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        icon
      )}
    </div>
  );
}

function MetricTile({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: "brand" | "success" | "danger" | "warning" | "neutral" }) {
  const toneClass = {
    brand: "text-brand bg-brand/10",
    success: "text-success bg-success/10",
    danger: "text-danger bg-danger/10",
    warning: "text-accent bg-accent/10",
    neutral: "text-text-muted bg-surface-muted",
  }[tone];
  return (
    <div className="min-w-[144px] rounded-lg border border-line bg-surface p-4">
      <div className={`mb-3 flex h-8 w-8 items-center justify-center rounded-md ${toneClass}`}>{icon}</div>
      <div className="text-xl font-bold leading-none text-text-strong">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
    </div>
  );
}

function MiniStat({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <div className="rounded-md border border-line bg-surface-muted/50 px-2 py-1.5">
      <div className={`text-xs font-bold ${tone === "danger" ? "text-danger" : "text-text-strong"}`}>{value}</div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-text-muted">{label}</div>
      <div className="mt-1 break-words font-mono text-xs font-medium text-text-strong">{value || "-"}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block text-xs font-bold text-text-strong">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1.5 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
      />
    </label>
  );
}

function SecretField({
  name,
  value,
  configured,
  masked,
  source,
  saving,
  onChange,
  onSave,
  onDelete,
}: {
  name: string;
  value: string;
  configured: boolean;
  masked: string;
  source: "local_store" | "runtime_env" | "missing";
  saving: boolean;
  onChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const sourceLabel = source === "local_store" ? "UI vault" : source === "runtime_env" ? "runtime env" : "faltante";

  return (
    <div className="rounded-lg border border-line bg-surface-muted/40 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-brand" />
            <code className="text-xs font-bold text-text-strong">{name}</code>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wide">
            <span className={configured ? "text-success" : "text-danger"}>{configured ? "configurado" : "pendiente"}</span>
            <span className="text-text-muted">{sourceLabel}</span>
            {masked ? <span className="font-mono normal-case tracking-normal text-text-muted">{masked}</span> : null}
          </div>
        </div>
        {configured && source === "local_store" ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="rounded-lg border border-danger/30 bg-danger/10 p-2 text-danger transition hover:bg-danger/20 disabled:opacity-50"
            aria-label={`Eliminar secreto ${name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="password"
          autoComplete="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={configured ? "Reemplazar secreto..." : "Pegar secreto..."}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
        />
        <button
          type="button"
          onClick={onSave}
          disabled={!value.trim() || saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-surface transition hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Guardando" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function AgentMultiSelect({
  agents,
  selectedIds,
  onChange,
}: {
  agents: NonNullable<AgentRegistry["agents"]>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase();
    return Object.entries(agents).filter(([id, agent]) => {
      return [id, agent.name, agent.display_name].filter(Boolean).join(" ").toLowerCase().includes(normalized);
    });
  }, [agents, query]);

  return (
    <div className="relative w-full">
      <div className="mb-2 flex flex-wrap gap-1.5">
        {selectedIds.map((id) => {
          const agent = agents[id];
          if (!agent) return null;
          return (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-muted py-1 pl-1.5 pr-2 text-xs font-semibold text-text-strong">
              <Initials name={agent.name || id} />
              <span>{agent.name || id}</span>
              <button type="button" onClick={() => onChange(selectedIds.filter((item) => item !== id))} className="text-text-muted transition hover:text-danger" aria-label={`Quitar ${agent.name || id}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
        {selectedIds.length === 0 ? <span className="text-xs font-medium text-text-muted">Ningún agente asignado.</span> : null}
      </div>

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs font-semibold text-text-strong transition hover:border-line-strong"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        Asignar agentes
        <ChevronsUpDown className="h-4 w-4 text-text-muted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 z-20 mt-1.5 flex max-h-72 w-full flex-col rounded-lg border border-line bg-surface p-2 shadow-xl">
            <div className="flex items-center gap-2 border-b border-line px-2 pb-2">
              <Search className="h-3.5 w-3.5 text-text-muted" />
              <input
                type="text"
                placeholder="Buscar agente..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full bg-transparent text-xs text-text-strong outline-none"
              />
            </div>
            <div className="mt-1 min-h-0 flex-1 overflow-y-auto">
              {filtered.map(([id, agent]) => {
                const isSelected = selectedIds.includes(id);
                const label = agent.name || id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange(isSelected ? selectedIds.filter((item) => item !== id) : [...selectedIds, id])}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-surface-muted"
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <Initials name={label} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-text-strong">{label}</span>
                        <span className="block truncate text-[10px] text-text-muted">{agent.display_name || "Agent"}</span>
                      </span>
                    </span>
                    {isSelected ? <Check className="h-4 w-4 text-brand" /> : null}
                  </button>
                );
              })}
              {filtered.length === 0 ? <div className="py-4 text-center text-xs text-text-muted">Sin resultados.</div> : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Initials({ name }: { name: string }) {
  const value = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
  return <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">{value}</span>;
}
