"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { AgentRegistry, Skill } from "../hooks/useOrchestrator";
import { agentAvatarUrl } from "./agentSettingsData";

type Props = {
  skills: Skill[];
  registry: AgentRegistry | null;
  onCreate: (name: string, description: string) => Promise<void | boolean>;
  onUpdate: (oldName: string, name: string, description: string) => Promise<void | boolean>;
  onDelete: (name: string) => Promise<void | boolean>;
  onUpdateAgentSkills: (agentId: string, skills: string[]) => Promise<void>;
};

export function SkillsSettings({ skills, registry, onCreate, onUpdate, onDelete, onUpdateAgentSkills }: Props) {
  const agents = registry?.agents || {};
  
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  
  // Creation state
  const [isCreating, setIsCreating] = useState(false);
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillDesc, setNewSkillDesc] = useState("");
  
  // Editing state
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const filteredSkills = useMemo(() => {
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase())
    );
  }, [skills, search]);

  const activeSkill = useMemo(() => {
    if (!selected) return null;
    return skills.find((s) => s.name === selected) || null;
  }, [skills, selected]);

  // Set initial selected skill
  useEffect(() => {
    if (!selected && skills.length > 0 && !isCreating) {
      setSelected(skills[0].name);
    }
  }, [skills, selected, isCreating]);

  // Sync editing fields when active skill changes
  useEffect(() => {
    if (activeSkill) {
      setEditName(activeSkill.name);
      setEditDesc(activeSkill.description || "");
      setIsCreating(false);
    }
  }, [activeSkill]);

  // Find agent IDs with this skill
  const selectedAgentIds = useMemo(() => {
    if (!selected) return [];
    return Object.entries(agents)
      .filter(([_, agent]) => (agent.skills || []).includes(selected))
      .map(([id]) => id);
  }, [agents, selected]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!newSkillName.trim()) return;
    await onCreate(newSkillName, newSkillDesc);
    setSelected(newSkillName);
    setIsCreating(false);
    setNewSkillName("");
    setNewSkillDesc("");
  }

  async function handleUpdate(e: FormEvent) {
    e.preventDefault();
    if (!selected || !editName.trim()) return;
    await onUpdate(selected, editName, editDesc);
    setSelected(editName);
  }

  async function handleDelete() {
    if (!selected) return;
    setPendingDelete(selected);
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    await onDelete(pendingDelete);
    const nextSkill = skills.find((s) => s.name !== pendingDelete);
    setSelected(nextSkill ? nextSkill.name : null);
    setPendingDelete(null);
  }

  return (
    <div className="relative grid h-[calc(100vh-73px)] grid-cols-[320px_1fr] overflow-hidden">
      {/* Left panel: List & Search */}
      <aside className="overflow-auto border-r border-line bg-surface p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined h-4 w-4 text-brand">book</span>
            <h2 className="text-sm font-semibold">Skills / Habilidades</h2>
          </div>
          <button 
            onClick={() => { setIsCreating(true); setSelected(null); }}
            className="p-1 rounded bg-brand/10 text-brand hover:bg-brand hover:text-white transition flex items-center justify-center"
            title="Crear Nueva Skill"
          >
            <span className="material-symbols-outlined h-4 w-4">add</span>
          </button>
        </div>
        <p className="mt-1 text-xs text-[var(--text-muted)]">Biblioteca global de capacidades.</p>
        
        {/* Search input */}
        <input
          type="text"
          placeholder="Buscar skill..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="mt-3 w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-text-strong outline-none transition focus:border-brand"
        />

        <div className="mt-4 flex-1 space-y-2 overflow-y-auto">
          {filteredSkills.map((s) => (
            <button
              key={s.name}
              onClick={() => { setSelected(s.name); setIsCreating(false); }}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selected === s.name && !isCreating
                  ? "border-brand bg-brand text-surface shadow-md shadow-brand/20"
                  : "border-line bg-surface hover:border-[var(--line-strong)] text-text-strong"
              }`}
            >
              <div className="font-semibold text-xs truncate">{s.name}</div>
              <div className={`mt-0.5 text-[10px] line-clamp-1 ${selected === s.name && !isCreating ? "opacity-70" : "text-text-muted"}`}>
                {s.description || "Sin descripción."}
              </div>
            </button>
          ))}
          {filteredSkills.length === 0 && (
            <div className="text-center py-6 text-xs text-text-muted font-medium">No se encontraron skills.</div>
          )}
        </div>
      </aside>

      {/* Right panel: Editor / Viewer */}
      <section className="overflow-auto p-6 bg-surface-muted/10">
        {isCreating ? (
          <form onSubmit={handleCreate} className="mx-auto max-w-2xl space-y-5 rise-in">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-xl font-bold text-text-strong tracking-tight">Crear Nueva Skill</h2>
                <p className="text-xs text-text-muted">Añade una capacidad al catálogo global.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button" 
                  onClick={() => { setIsCreating(false); setSelected(skills[0]?.name || null); }}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-muted text-text-strong transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-surface hover:bg-brand-strong transition"
                >
                  <span className="material-symbols-outlined h-3.5 w-3.5 animate-bounce-hover">save</span>
                  Guardar Skill
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-text-strong">
                Nombre de la Skill
                <input
                  type="text"
                  required
                  placeholder="Business goal decomposition"
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                />
              </label>
              
              <label className="block text-xs font-semibold text-text-strong">
                Descripción
                <textarea
                  placeholder="Explica detalladamente qué hace o cómo se aplica esta habilidad..."
                  value={newSkillDesc}
                  onChange={(e) => setNewSkillDesc(e.target.value)}
                  className="mt-2 min-h-32 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                />
              </label>
            </div>
          </form>
        ) : activeSkill ? (
          <form onSubmit={handleUpdate} className="mx-auto max-w-2xl space-y-6 rise-in">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-xl font-bold text-text-strong tracking-tight">{activeSkill.name}</h2>
                <p className="text-xs text-text-muted">Editar parámetros o ver asignaciones.</p>
              </div>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20 transition"
                >
                  <span className="material-symbols-outlined h-3.5 w-3.5">delete</span>
                  Eliminar Skill
                </button>
                <button 
                  type="submit" 
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-1.5 text-xs font-semibold text-surface hover:bg-brand-strong transition shadow-sm"
                >
                  <span className="material-symbols-outlined h-3.5 w-3.5 animate-bounce-hover">save</span>
                  Guardar cambios
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-semibold text-text-strong">
                Nombre de la Skill
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                />
              </label>
              
              <label className="block text-xs font-semibold text-text-strong">
                Descripción
                <textarea
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  className="mt-2 min-h-24 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand"
                />
              </label>
            </div>

            {/* Assigned Agents section */}
            <div className="pt-4 border-t border-line">
              <h3 className="text-xs font-bold text-text-strong uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <span className="material-symbols-outlined h-3.5 w-3.5 text-brand">group</span>
                Asignación de Habilidad a Agentes
              </h3>
              
              <AgentMultiSelect
                agents={agents}
                selectedIds={selectedAgentIds}
                onChange={async (newIds) => {
                  if (!selected) return;
                  for (const [id, agent] of Object.entries(agents)) {
                    const wasAssigned = (agent.skills || []).includes(selected);
                    const isAssignedNow = newIds.includes(id);
                    if (wasAssigned !== isAssignedNow) {
                      let newSkills = [...(agent.skills || [])];
                      if (wasAssigned) {
                        newSkills = newSkills.filter((s) => s !== selected);
                      } else {
                        newSkills.push(selected);
                      }
                      await onUpdateAgentSkills(id, newSkills);
                    }
                  }
                }}
              />
            </div>
          </form>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--text-muted)]">
            Selecciona una habilidad o crea una nueva.
          </div>
        )}
      </section>

      {pendingDelete ? (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-lg border border-line bg-surface p-5 shadow-2xl rise-in">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-danger/10 text-danger">
                <span className="material-symbols-outlined h-4 w-4">delete</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-strong">Eliminar habilidad</h3>
                <p className="mt-1 text-xs leading-relaxed text-text-muted">
                  Se eliminará <span className="font-semibold text-text-strong">{pendingDelete}</span> del catálogo y de los agentes asignados.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                className="rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong transition hover:bg-surface-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white transition hover:opacity-90 active:scale-95"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AgentMultiSelect({
  agents,
  selectedIds,
  onChange
}: {
  agents: NonNullable<AgentRegistry["agents"]>;
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return Object.entries(agents).filter(([id, agent]) => {
      const name = (agent.name || "").toLowerCase();
      const role = (agent.display_name || "").toLowerCase();
      const q = query.toLowerCase();
      return name.includes(q) || role.includes(q) || id.includes(q);
    });
  }, [agents, query]);

  return (
    <div className="relative w-full max-w-md">
      {/* Selected Tags list */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {selectedIds.map((id) => {
          const agent = agents[id];
          if (!agent) return null;
          const avatarUrl = agent.avatar_url || agentAvatarUrl(agent.name || id);
          return (
            <span 
              key={id} 
              className="inline-flex items-center gap-1 bg-surface-muted hover:bg-line border border-line rounded-full pl-1 pr-2 py-0.5 text-xs font-semibold text-text-strong transition"
            >
              <img src={avatarUrl} className="avatar-image w-4 h-4 rounded-full border border-line object-fill" alt="" />
              <span>{agent.name || id}</span>
              <button 
                type="button" 
                onClick={() => onChange(selectedIds.filter((x) => x !== id))}
                className="text-text-muted hover:text-danger transition flex items-center justify-center"
              >
                <span className="material-symbols-outlined h-3 w-3">close</span>
              </button>
            </span>
          );
        })}
        {selectedIds.length === 0 && (
          <span className="text-xs text-text-muted italic">Ningún agente asignado.</span>
        )}
      </div>

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-left text-xs shadow-sm hover:border-[var(--line-strong)] transition focus:outline-none"
      >
        <span className="text-text-strong font-medium">Asignar agentes...</span>
        <span className="material-symbols-outlined h-4 w-4 text-text-muted">unfold_more</span>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          {/* Backdrop to close click */}
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          
          <div className="absolute left-0 mt-1.5 z-20 w-full rounded-xl border border-line bg-surface p-2 shadow-xl fade-in max-h-72 flex flex-col">
            {/* Search Input */}
            <div className="flex items-center gap-2 border-b border-line px-2.5 pb-2 pt-1">
              <span className="material-symbols-outlined h-3.5 w-3.5 text-text-muted">search</span>
              <input
                type="text"
                placeholder="Buscar agente..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full text-xs outline-none bg-transparent text-text-strong"
              />
            </div>
            
            {/* Scrollable list */}
            <div className="flex-1 overflow-y-auto mt-1 space-y-0.5">
              {filtered.map(([id, agent]) => {
                const isSelected = selectedIds.includes(id);
                const avatarUrl = agent.avatar_url || agentAvatarUrl(agent.name || id);
                
                const handleToggle = () => {
                  if (isSelected) {
                    onChange(selectedIds.filter((x) => x !== id));
                  } else {
                    onChange([...selectedIds, id]);
                  }
                };
                
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={handleToggle}
                    className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs hover:bg-surface-muted transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <img src={avatarUrl} className="avatar-image w-6 h-6 rounded-full border border-line object-fill" alt="" />
                      <div>
                        <div className="font-semibold text-text-strong">{agent.name || id}</div>
                        <div className="text-[10px] text-text-muted">{agent.display_name || "Agent"}</div>
                      </div>
                    </div>
                    {isSelected && <span className="material-symbols-outlined h-4 w-4 text-brand font-bold">check</span>}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="py-4 text-center text-xs text-text-muted italic">No se encontraron agentes.</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
