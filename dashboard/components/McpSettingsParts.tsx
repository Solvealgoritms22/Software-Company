import { type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { prism } from "react-syntax-highlighter/dist/esm/styles/prism";
import { SiConfluence, SiGithub, SiGoogledrive, SiJira, SiVercel } from "react-icons/si";

import type { AgentRegistry, McpCatalog, McpSecretsResponse } from "../hooks/useOrchestrator";
import { MaterialIcon } from "./MaterialIcon";
import { AgentMultiSelect } from "./McpAgentMultiSelect";
import { EXPORT_CLIENTS, MCP_LOGOS, type ServerItem } from "./mcpSettingsData";

export function ServerCard({
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
          <ServerIcon name={server.name} category={server.category} iconUrl={server.icon_url} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-bold text-text-strong">{server.display_name || server.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
              <span className={enabled ? "text-success" : "text-text-muted"}>{enabled ? "activo" : "inactivo"}</span>
              <span className="text-text-muted">{server.kind || "stdio"}</span>
              <span className="text-text-muted">{server.category || "registered"}</span>
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
        {server.description || "Servidor MCP registrado sin descripción."}
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

export function McpDrawer({
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
            <ServerIcon name={name} category={server.category} iconUrl={server.icon_url} />
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
              <MaterialIcon name="power_settings_new" className="w-4" />
              {server.enabled ? "Desactivar" : "Activar"}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-text-muted transition hover:bg-surface-muted hover:text-text-strong" aria-label="Cerrar panel MCP">
              <MaterialIcon name="close" className="w-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 scroll-mask-y">
          <section className="rounded-lg border border-line bg-surface-muted/40 p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Info label="Tipo" value={server.kind || "stdio"} />
              <Info label="Categoría" value={server.category || "registered"} />
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
                  <MaterialIcon name="lock" className="w-4 text-brand" />
                  Secretos requeridos
                </h3>
                <p className="mt-1 text-xs text-text-muted">Los valores se guardan en el vault local del orquestador.</p>
              </div>
              {missingSecrets.length ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-danger/10 px-2 py-1 text-xs font-bold text-danger">
                  <MaterialIcon name="warning" className="w-3.5" />
                  {missingSecrets.length} faltan
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-xs font-bold text-success">
                  <MaterialIcon name="check_circle" className="w-3.5" />
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
                    <MaterialIcon name="code" className="w-3.5" />
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
                  {copied ? <MaterialIcon name="check" className="w-4 text-success" /> : <MaterialIcon name="content_copy" className="w-4" />}
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
              <MaterialIcon name="open_in_new" className="w-4" />
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
            <MaterialIcon name="save" className="w-4" />
            Guardar configuración
          </button>
        </div>
      </div>
    </div>
  );
}

export function ServerIcon({ name, category, iconUrl }: { name: string; category?: string; iconUrl?: string }) {
  const lower = `${name} ${category || ""}`.toLowerCase();
  const className = "h-5 w-5";
  const logo = iconUrl ? { src: iconUrl } : MCP_LOGOS[name];
  const logoClassName = name === "aws_mcp" ? "h-5 w-7" : "h-5 w-5";
  let icon = <MaterialIcon name="build" className="w-5" />;
  if (lower.includes("github")) icon = <SiGithub className={className} />;
  else if (lower.includes("jira")) icon = <SiJira className={className} />;
  else if (lower.includes("confluence")) icon = <SiConfluence className={className} />;
  else if (lower.includes("drive")) icon = <SiGoogledrive className={className} />;
  else if (lower.includes("deploy") || lower.includes("vercel")) icon = <SiVercel className={className} />;
  else if (lower.includes("database") || lower.includes("postgres") || lower.includes("sqlite")) icon = <MaterialIcon name="database" className="w-5" />;
  else if (lower.includes("security")) icon = <MaterialIcon name="verified_user" className="w-5" />;
  else if (lower.includes("playwright") || lower.includes("puppeteer")) icon = <MaterialIcon name="find_in_page" className="w-5" />;
  else if (lower.includes("workspace") || lower.includes("filesystem")) icon = <MaterialIcon name="terminal" className="w-5" />;
  else if (lower.includes("memory") || lower.includes("knowledge")) icon = <MaterialIcon name="psychology" className="w-5" />;
  else if (lower.includes("fetch") || lower.includes("brave")) icon = <MaterialIcon name="public" className="w-5" />;
  else if (lower.includes("aws") || lower.includes("cloud")) icon = <MaterialIcon name="cloud" className="w-5" />;
  else if (lower.includes("agent")) icon = <MaterialIcon name="smart_toy" className="w-5" />;

  return (
    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-line bg-surface-muted text-brand">
      {logo ? (
        <>
          <img
            src={logo.src}
            className={`${logoClassName} object-contain ${logo.darkSrc ? "dark:hidden" : ""} ${logo.invertDark ? "dark:invert" : ""}`}
            alt=""
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          {logo.darkSrc ? (
            <img
              src={logo.darkSrc}
              className={`hidden ${logoClassName} object-contain dark:block`}
              alt=""
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          ) : null}
        </>
      ) : (
        icon
      )}
    </div>
  );
}

export function MetricTile({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: "brand" | "success" | "danger" | "warning" | "neutral" }) {
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

export function Field({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
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
            <MaterialIcon name="key" className="w-3.5 text-brand" />
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
            <MaterialIcon name="delete" className="w-3.5" />
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
          <MaterialIcon name="save" className="w-3.5" />
          {saving ? "Guardando" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
