"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";


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

import { EXPORT_CLIENTS, OFFICIAL_MCP_PRESETS, type ServerItem } from "./mcpSettingsData";
import { Field, McpDrawer, MetricTile, ServerCard, ServerIcon } from "./McpSettingsParts";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<"official" | "custom">("official");
  const [customName, setCustomName] = useState("");
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [customCategory, setCustomCategory] = useState("custom");
  const [customCommand, setCustomCommand] = useState("npx");
  const [customArgs, setCustomArgs] = useState("-y package-name");
  const [customDescription, setCustomDescription] = useState("");
  const [customLogoUrl, setCustomLogoUrl] = useState("");

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

  const availableOfficialPresets = useMemo(
    () => OFFICIAL_MCP_PRESETS.filter((preset) => !servers[preset.name]),
    [servers]
  );

  async function addOfficialServer(preset: ServerItem) {
    await onSave(preset.name, {
      enabled: false,
      kind: preset.kind || "stdio",
      category: preset.category,
      display_name: preset.display_name,
      description: preset.description,
      command: preset.command,
      args: preset.args || [],
      docs_url: preset.docs_url,
      required_for: preset.required_for || [],
      env_keys: preset.env_keys || [],
    });
    setSelected(preset.name);
    setIsAddModalOpen(false);
  }

  async function addCustomServer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = customName.trim();
    if (!name) return;
    await onSave(name, {
      enabled: false,
      kind: "stdio",
      category: customCategory.trim() || "custom",
      display_name: customDisplayName.trim() || name,
      description: customDescription.trim() || "Custom MCP registered from dashboard.",
      icon_url: customLogoUrl.trim() || undefined,
      command: customCommand.trim(),
      args: customArgs.split(/\s+/).filter(Boolean),
      required_for: [],
      env_keys: [],
    });
    setSelected(name);
    setCustomName("");
    setCustomDisplayName("");
    setCustomCategory("custom");
    setCustomCommand("npx");
    setCustomArgs("-y package-name");
    setCustomDescription("");
    setCustomLogoUrl("");
    setIsAddModalOpen(false);
    setAddMode("official");
  }

  function readCustomLogo(file: File | null) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomLogoUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex h-[calc(100vh-73px)] flex-col overflow-hidden bg-background">
      <header className="border-b border-line bg-surface px-5 py-4">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
              <MaterialIcon name="extension" className="w-4" />
              Tool Runtime
            </div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-text-strong">MCP Operations Console</h1>
            <p className="mt-1 max-w-3xl text-sm leading-relaxed text-text-muted">
              Controla servidores MCP, permisos de agentes, secretos requeridos y exportaciones de clientes sin salir del dashboard.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 p-1 sm:grid-cols-4">
            <MetricTile label="Activos" value={`${activeCount}/${serversList.length}`} icon={<MaterialIcon name="power" className="w-4" />} tone="brand" />
            <MetricTile label="Secretos" value={`${totalSecretRefs - missingSecretRefs}/${totalSecretRefs || 0}`} icon={<MaterialIcon name="key" className="w-4" />} tone={missingSecretRefs ? "warning" : "success"} />
            <MetricTile label="Agentes" value={String(assignedAgents)} icon={<MaterialIcon name="group" className="w-4" />} tone="neutral" />
            <MetricTile label="Riesgo" value={missingSecretRefs ? `${missingSecretRefs} faltan` : "OK"} icon={<MaterialIcon name="verified_user" className="w-4" />} tone={missingSecretRefs ? "danger" : "success"} />
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-3 border-b border-line bg-surface-muted/50 px-5 py-3 md:flex-row md:items-center md:justify-between">
        <div className="relative min-w-0 flex-1 md:max-w-xl">
          <MaterialIcon name="search" className="absolute left-3 top-1/2 w-4 -translate-y-1/2 text-text-muted" style={{ transform: 'translateY(-50%)' }} />
          <input
            type="search"
            name="mcp_catalog_search"
            autoComplete="off"
            spellCheck={false}
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
          <MaterialIcon name="add" className="w-4" />
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
            className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl border border-line bg-surface shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-mcp-title"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 id="add-mcp-title" className="text-base font-bold text-text-strong">Agregar MCP</h2>
                <p className="mt-0.5 text-xs text-text-muted">Registra un servidor oficial o uno custom con su logo.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-strong"
                aria-label="Cerrar modal"
              >
                <MaterialIcon name="close" className="w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              <div className="grid grid-cols-2 rounded-lg border border-line bg-surface-muted/40 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => setAddMode("official")}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition ${addMode === "official" ? "bg-surface text-text-strong shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                >
                  Oficiales
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode("custom")}
                  className={`rounded-md px-3 py-2 text-xs font-bold transition ${addMode === "custom" ? "bg-surface text-text-strong shadow-sm" : "text-text-muted hover:text-text-strong"}`}
                >
                  Custom
                </button>
              </div>

              {addMode === "official" ? (
                <div className="space-y-3">
                  {availableOfficialPresets.length === 0 ? (
                    <div className="rounded-lg border border-line bg-surface-muted/40 p-4 text-sm font-medium text-text-muted">
                      Ya tienes registrados los presets oficiales disponibles.
                    </div>
                  ) : (
                    availableOfficialPresets.map((preset) => (
                      <button
                        key={preset.name}
                        type="button"
                        onClick={() => addOfficialServer(preset)}
                        className="flex w-full items-start gap-3 rounded-lg border border-line bg-surface p-3 text-left transition hover:border-[var(--line-strong)] hover:bg-surface-muted"
                      >
                        <ServerIcon name={preset.name} category={preset.category} iconUrl={preset.icon_url} />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-text-strong">{preset.display_name}</span>
                          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-text-muted">{preset.description}</span>
                          <span className="mt-2 block truncate font-mono text-[11px] text-text-muted">
                            {preset.command} {(preset.args || []).join(" ")}
                          </span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              ) : (
                <form id="add-custom-mcp-form" onSubmit={addCustomServer} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-[88px_1fr]">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface-muted text-brand">
                        {customLogoUrl ? <img src={customLogoUrl} className="h-12 w-12 object-contain" alt="" /> : <MaterialIcon name="build" className="w-6" />}
                      </div>
                      <label className="cursor-pointer rounded-md border border-line bg-surface px-2 py-1.5 text-[11px] font-bold text-text-strong transition hover:bg-surface-muted">
                        Logo
                        <input
                          type="file"
                          accept="image/svg+xml,image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(event) => readCustomLogo(event.target.files?.[0] || null)}
                        />
                      </label>
                    </div>
                    <div className="space-y-3">
                      <Field label="ID del servidor" value={customName} onChange={setCustomName} placeholder="mi_mcp" required />
                      <Field label="Nombre visible" value={customDisplayName} onChange={setCustomDisplayName} placeholder="Mi MCP" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Comando" value={customCommand} onChange={setCustomCommand} placeholder="npx" required />
                    <Field label="Categoría" value={customCategory} onChange={setCustomCategory} placeholder="custom" />
                  </div>
                  <Field label="Argumentos" value={customArgs} onChange={setCustomArgs} placeholder="-y package-name" />
                  <Field label="Logo URL opcional" value={customLogoUrl} onChange={setCustomLogoUrl} placeholder="https://... o data:image/svg+xml..." />
                  <Field label="Descripción" value={customDescription} onChange={setCustomDescription} placeholder="Qué herramientas expone este MCP." />
                </form>
              )}
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-4 bg-surface rounded-b-xl">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-muted"
              >
                Cancelar
              </button>
              {addMode === "custom" && (
                <button
                  type="submit"
                  form="add-custom-mcp-form"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-surface transition hover:bg-brand-strong"
                >
                  Guardar custom
                </button>
              )}
            </div>
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
