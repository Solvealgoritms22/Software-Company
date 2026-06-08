import { useMemo, useState } from "react";
import type { AgentRegistry } from "../hooks/useOrchestrator";
import { MaterialIcon } from "./MaterialIcon";
import { agentAvatarUrl } from "./agentSettingsData";

export function AgentMultiSelect({
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
  const avatarUrl = agent.avatar_url || agentAvatarUrl(label);
  return (
    <span className="avatar-surface relative flex h-6 w-6 flex-shrink-0 items-center justify-center overflow-hidden rounded-full border border-line">
      <span className="flex h-full w-full items-center justify-center bg-brand/10 text-[10px] font-bold text-brand">
        {initials(label)}
      </span>
      <img
        src={avatarUrl}
        alt=""
        className="avatar-image absolute inset-0 h-full w-full object-fill"
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
