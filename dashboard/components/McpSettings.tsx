"use client";

import { type Dispatch, type FormEvent, type ReactNode, type SetStateAction, useEffect, useMemo, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";

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

const svgData = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
const awsLogo = (fill: string) =>
  svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 306"><text x="20" y="170" font-family="Arial Black, Arial, sans-serif" font-size="150" font-weight="900" letter-spacing="-10" fill="${fill}">aws</text><path fill="#f90" d="M462.9 243.7c-56 41.4-137.4 63.3-207.4 63.3-98.1 0-186.5-36.3-253.2-96.6-5.3-4.8-.5-11.2 5.8-7.5 72.2 41.9 161.3 67.3 253.4 67.3 62.2 0 130.4-12.9 193.3-39.5 9.3-4.2 17.3 6.2 8.1 13"/><path fill="#f90" d="M486.2 217.2c-7.2-9.2-47.3-4.4-65.6-2.2-5.4.7-6.3-4.1-1.4-7.7 32-22.5 84.6-16 90.8-8.5 6.1 7.7-1.7 60.3-31.7 85.5-4.6 3.9-9 1.9-7-3.2 6.9-16.9 22.1-54.9 14.9-63.9"/></svg>`);

const MCP_LOGOS: Record<string, { src: string; darkSrc?: string; invertDark?: boolean }> = {
  github_mcp: { src: "https://cdn.simpleicons.org/github", invertDark: true },
  jira_mcp: { src: "https://cdn.simpleicons.org/jira" },
  confluence_mcp: { src: "https://cdn.simpleicons.org/confluence" },
  google_drive_mcp: { src: "https://cdn.simpleicons.org/googledrive" },
  deploy_mcp: { src: "https://cdn.simpleicons.org/vercel", invertDark: true },
  context7_mcp: { src: "https://avatars.githubusercontent.com/u/74989412?s=48&v=4" },
  slack_mcp: {
    src: svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#e01e5a" d="M107.9 323.6c0 29.7-24 53.8-53.8 53.8S.3 353.4.3 323.6c0-29.7 24-53.8 53.8-53.8h53.8zm26.9 0c0-29.7 24-53.8 53.8-53.8s53.8 24 53.8 53.8V458c0 29.7-24 53.8-53.8 53.8s-53.8-24-53.8-53.8z"/><path fill="#36c5f0" d="M188.6 107.7c-29.7 0-53.8-24-53.8-53.8S158.8.1 188.6.1s53.8 24 53.8 53.8v53.8zm0 27.3c29.7 0 53.8 24 53.8 53.8s-24 53.8-53.8 53.8H53.8C24 242.6 0 218.5 0 188.8S24 135 53.8 135z"/><path fill="#2eb67d" d="M404.1 188.8c0-29.7 24-53.8 53.8-53.8s53.8 24 53.8 53.8-24 53.8-53.8 53.8h-53.8zm-26.9 0c0 29.7-24 53.8-53.8 53.8-29.7 0-53.8-24-53.8-53.8V54c0-29.7 24-53.8 53.8-53.8s53.8 24 53.8 53.8z"/><path fill="#ecb22e" d="M323.4 404.3c29.7 0 53.8 24 53.8 53.8 0 29.7-24 53.8-53.8 53.8-29.7 0-53.8-24-53.8-53.8v-53.8zm0-26.9c-29.7 0-53.8-24-53.8-53.8s24-53.8 53.8-53.8h134.8c29.7 0 53.8 24 53.8 53.8 0 29.7-24 53.8-53.8 53.8z"/></svg>`),
  },
  sentry_mcp: {
    src: svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path fill="#362d59" d="M296.7 53.5c-13.6-22.6-43.1-29.9-65.7-16.3-6.7 4-12.3 9.6-16.3 16.3L147.3 169c104.9 52.3 174.1 156.4 181.9 273.3h-47.4c-7.8-100.3-68-188.9-158.4-232.9L61 317.3c50.7 22.8 86.4 69.8 94.6 124.7H46.8c-4.3-.3-7.5-4-7.2-8.3.1-1.1.4-2.1.9-3.1l30.1-51.3c-10.2-8.5-21.9-15.1-34.4-19.5L6.3 411.2c-12.9 22.2-5.4 50.7 16.8 63.6l.6.3c7.1 4 15 6.1 23.2 6.2h148.9c5.6-69.4-25.5-136.7-82-177.4l23.7-41c71.4 49 111.5 132.1 105.6 218.4h126.2c6-130.9-58.1-255-168.2-326l47.9-82c2.2-3.7 7-5 10.8-2.8 5.4 3 208 356.4 211.8 360.5 2.1 3.8.7 8.5-3 10.6-1.2.7-2.6 1-4 1h-48.8c.6 13.1.6 26.1 0 39.1h49c26 .2 47.2-20.8 47.4-46.7v-.5a46 46 0 0 0-6.4-23.4z"/></svg>`),
  },
  memory_mcp: {
    src: svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" d="M3.5 12c.015 0 .028-.004.042-.004l.94 4.226a2.497 2.497 0 1 0 3.345 3.173l7.182 1.197a2.491 2.491 0 1 0 3.527-2.36l1.902-8.238c.021 0 .04.006.062.006a2.5 2.5 0 1 0-2.03-3.95l-4.53-2.012a2.5 2.5 0 1 0-4.692.528L5.151 7.637A2.495 2.495 0 1 0 3.5 12zm1.018-.222a2.51 2.51 0 0 0 1.26-1.26l4.226.94c0 .014-.004.027-.004.042a2.484 2.484 0 0 0 .416 1.377l-3.54 3.54A2.483 2.483 0 0 0 5.5 16c-.014 0-.028.004-.042.004zm7.184-2.635a2.501 2.501 0 0 0-1.48 1.339l-4.226-.94c0-.014.004-.027.004-.042a2.472 2.472 0 0 0-.247-1.065l4.096-3.072a2.477 2.477 0 0 0 1.457.617zM14 11v1a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1z"/></svg>`),
    invertDark: true,
  },
  security_mcp: {
    src: svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M20.91 11.12C20.91 16.01 17.36 20.59 12.51 21.93C12.18 22.02 11.82 22.02 11.49 21.93C6.64 20.59 3.09 16.01 3.09 11.12V6.73C3.09 5.91 3.71 4.98 4.48 4.67L10.05 2.39C11.3 1.88 12.71 1.88 13.96 2.39L19.53 4.67C20.29 4.98 20.92 5.91 20.92 6.73L20.91 11.12Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12.5C13.1046 12.5 14 11.6046 14 10.5C14 9.39543 13.1046 8.5 12 8.5C10.8954 8.5 10 9.39543 10 10.5C10 11.6046 10.8954 12.5 12 12.5Z" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12.5V15.5" stroke="#292D32" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`),
    invertDark: true,
  },
  filesystem_mcp: {
    src: svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 460 460"><path fill="#96C8EF" d="M375.229 0H186.995c-15.655 0-28.346 12.691-28.346 28.347l-.178 318.777H375.23c15.655 0 28.346-12.691 28.346-28.346V28.347C403.575 12.691 390.884 0 375.229 0z"/><path opacity=".1" d="M315.887 346.464V137.622c0-23.583-19.118-42.701-42.701-42.701H158.47v251.542z"/><path fill="#C2DFF6" d="M301.352 141.223c0-15.655-12.691-28.347-28.346-28.347H84.771c-15.655 0-28.346 12.691-28.346 28.347v290.431c0 15.656 12.691 28.347 28.346 28.347h188.234c15.655 0 28.346-12.691 28.346-28.347z"/></svg>`),
  },
  playwright_mcp: { src: "https://playwright.dev/img/playwright-logo.svg" },
  puppeteer_mcp: { src: "https://cdn.simpleicons.org/puppeteer/00D8A2" },
  postgres_mcp: { src: "https://cdn.simpleicons.org/postgresql/336791" },
  sqlite_mcp: { src: "https://cdn.simpleicons.org/sqlite/003B57" },
  brave_search_mcp: { src: "https://cdn.simpleicons.org/brave/F1562B" },
  aws_mcp: {
    src: awsLogo("#000000"),
    darkSrc: awsLogo("#ffffff"),
  },
  fetch_mcp: { src: "https://cdn.simpleicons.org/firefoxbrowser/FF7139" },
  git_mcp: { src: "https://cdn.simpleicons.org/git/F05032" },
  sequential_thinking_mcp: { src: "https://cdn.simpleicons.org/anthropic/191919", invertDark: true },
  time_mcp: { src: "https://cdn.simpleicons.org/clockify/03A9F4" },
  everything_mcp: { src: "https://cdn.simpleicons.org/modelcontextprotocol/000000", invertDark: true },
  google_maps_mcp: { src: "https://cdn.simpleicons.org/googlemaps/4285F4" },
};

const OFFICIAL_MCP_PRESETS: ServerItem[] = [
  {
    name: "git_mcp",
    enabled: false,
    kind: "stdio",
    category: "developer_tools",
    display_name: "Git MCP",
    description: "Official reference server for reading, searching and manipulating Git repositories.",
    command: "uvx",
    args: ["mcp-server-git", "--repository", "."],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/git",
    required_for: ["backend_developer", "frontend_developer", "software_architect"],
    env_keys: [],
  },
  {
    name: "sequential_thinking_mcp",
    enabled: false,
    kind: "stdio",
    category: "reasoning",
    display_name: "Sequential Thinking MCP",
    description: "Official reference server for dynamic and reflective step-by-step reasoning.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    required_for: ["ceo", "software_architect", "senior_backend"],
    env_keys: [],
  },
  {
    name: "time_mcp",
    enabled: false,
    kind: "stdio",
    category: "utility",
    display_name: "Time MCP",
    description: "Official reference server for time and timezone conversion.",
    command: "uvx",
    args: ["mcp-server-time"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/time",
    required_for: ["business_analyst", "technical_writer", "ceo"],
    env_keys: [],
  },
  {
    name: "everything_mcp",
    enabled: false,
    kind: "stdio",
    category: "reference",
    display_name: "Everything MCP",
    description: "Official reference/test server with prompts, resources and tools.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-everything"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/everything",
    required_for: ["software_architect"],
    env_keys: [],
  },
  {
    name: "filesystem_mcp",
    enabled: false,
    kind: "stdio",
    category: "utilities",
    display_name: "Filesystem MCP",
    description: "Official reference server for secure file system access (read, write, list files).",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem", "."],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    required_for: ["backend_developer", "software_architect"],
    env_keys: [],
  },
  {
    name: "postgres_mcp",
    enabled: false,
    kind: "stdio",
    category: "database",
    display_name: "PostgreSQL MCP",
    description: "Official reference server for database inspection and query execution on PostgreSQL.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", "postgresql://localhost:5432/db"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    required_for: ["backend_developer", "software_architect"],
    env_keys: [],
  },
  {
    name: "sqlite_mcp",
    enabled: false,
    kind: "stdio",
    category: "database",
    display_name: "SQLite MCP",
    description: "Official reference server for querying and managing SQLite databases.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite", "--db", "database.db"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
    required_for: ["backend_developer", "software_architect"],
    env_keys: [],
  },
  {
    name: "brave_search_mcp",
    enabled: false,
    kind: "stdio",
    category: "search",
    display_name: "Brave Search MCP",
    description: "Official reference server for web searching via the Brave Search API.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-brave-search"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    required_for: ["ceo", "business_analyst", "qa_engineer"],
    env_keys: ["BRAVE_API_KEY"],
  },
  {
    name: "fetch_mcp",
    enabled: false,
    kind: "stdio",
    category: "utility",
    display_name: "Fetch MCP",
    description: "Official reference server for fetching and converting web page content to markdown.",
    command: "uvx",
    args: ["mcp-server-fetch"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    required_for: ["technical_writer", "business_analyst"],
    env_keys: [],
  },
  {
    name: "playwright_mcp",
    enabled: false,
    kind: "stdio",
    category: "web",
    display_name: "Playwright MCP",
    description: "Official reference server for web automation and browser scraping using Playwright.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-playwright"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/playwright",
    required_for: ["qa_engineer", "frontend_developer"],
    env_keys: [],
  },
  {
    name: "puppeteer_mcp",
    enabled: false,
    kind: "stdio",
    category: "web",
    display_name: "Puppeteer MCP",
    description: "Official reference server for browser control and automation using Puppeteer.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
    required_for: ["qa_engineer", "frontend_developer"],
    env_keys: [],
  },
  {
    name: "github_mcp",
    enabled: false,
    kind: "stdio",
    category: "developer_tools",
    display_name: "GitHub MCP",
    description: "Official reference server for interacting with GitHub repositories, issues, PRs and gists.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    required_for: ["backend_developer", "frontend_developer", "software_architect"],
    env_keys: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
  },
  {
    name: "slack_mcp",
    enabled: false,
    kind: "stdio",
    category: "chat",
    display_name: "Slack MCP",
    description: "Official reference server for Slack integration, sending messages and reading channels.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    required_for: ["ceo", "business_analyst"],
    env_keys: ["SLACK_BOT_TOKEN"],
  },
  {
    name: "google_maps_mcp",
    enabled: false,
    kind: "stdio",
    category: "navigation",
    display_name: "Google Maps MCP",
    description: "Official reference server for geocoding, places searches, and navigation details.",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-google-maps"],
    docs_url: "https://github.com/modelcontextprotocol/servers/tree/main/src/google-maps",
    required_for: ["business_analyst"],
    env_keys: ["GOOGLE_MAPS_API_KEY"],
  },
];

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

function ServerIcon({ name, category, iconUrl }: { name: string; category?: string; iconUrl?: string }) {
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
              <AgentAvatar agent={agent} id={id} />
              <span>{agent.name || id}</span>
              <button type="button" onClick={() => onChange(selectedIds.filter((item) => item !== id))} className="text-text-muted transition hover:text-danger" aria-label={`Quitar ${agent.name || id}`}>
                <MaterialIcon name="close" className="w-3" />
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
        <MaterialIcon name="unfold_more" className="w-4 text-text-muted" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 z-20 mt-1.5 flex max-h-72 w-full flex-col rounded-lg border border-line bg-surface p-2 shadow-xl">
            <div className="flex items-center gap-2 border-b border-line px-2 pb-2">
              <MaterialIcon name="search" className="w-3.5 text-text-muted" />
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
                      <AgentAvatar agent={agent} id={id} />
                      <span className="min-w-0">
                        <span className="block truncate font-semibold text-text-strong">{label}</span>
                        <span className="block truncate text-[10px] text-text-muted">{agent.display_name || "Agent"}</span>
                      </span>
                    </span>
                    {isSelected ? <MaterialIcon name="check" className="w-4 text-brand" /> : null}
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

function AgentAvatar({ agent, id }: { agent: NonNullable<AgentRegistry["agents"]>[string]; id: string }) {
  const label = agent.name || agent.display_name || id;
  const avatarUrl = agent.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(label)}`;
  return (
    <span className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-surface">
      <span className="flex h-full w-full items-center justify-center bg-brand/10 text-[10px] font-bold text-brand">
        {initials(label)}
      </span>
      <img
        src={avatarUrl}
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}

function Initials({ name }: { name: string }) {
  return <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand/10 text-[10px] font-bold text-brand">{initials(name)}</span>;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "?";
}
