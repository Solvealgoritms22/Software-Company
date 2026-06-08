import { FormEvent } from "react";

import { MaterialIcon } from "../MaterialIcon";
import type { useOrchestrator } from "../../hooks/useOrchestrator";
import type { FactoryText } from "./translations";
import { Area, Field, SectionTitle } from "./utils";

type Orchestrator = ReturnType<typeof useOrchestrator>;

type Props = {
  t: FactoryText;
  language: string;
  name: string;
  setName: (value: string) => void;
  goal: string;
  setGoal: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isCreating: boolean;
  error: string | null;
  projects: Orchestrator["projects"];
  project: Orchestrator["project"];
  setProject: Orchestrator["setProject"];
  deleteProject: (id: string) => Promise<void>;
  stopProject: (id: string) => Promise<void>;
  openWorkspace: (id: string) => Promise<void>;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  projectToDelete: { id: string; name: string } | null;
  setProjectToDelete: (value: { id: string; name: string } | null) => void;
};

export function FactoryLeftPanel({
  t,
  language,
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
  isOpen,
  setIsOpen,
  searchQuery,
  setSearchQuery,
  projectToDelete,
  setProjectToDelete,
}: Props) {
  const filteredProjects = projects.filter((item) => item.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      {isOpen && (
        <aside className="border-r border-line bg-surface p-4 overflow-y-auto scroll-mask-y">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MaterialIcon name="auto_awesome" className="w-4 text-brand" animate="sparkle" />
              <span className="text-text-strong">{t.newProject}</span>
            </div>
            <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-strong" title="Ocultar panel izquierdo">
              <MaterialIcon name="chevron_left" className="w-4" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="quiet-card space-y-3 p-4">
            <Field label={t.projectName} value={name} onChange={setName} placeholder="MVP Cliente" />
            <Area label={t.clientRequirement} value={goal} onChange={setGoal} minHeight="min-h-28" placeholder="Crear un sistema funcional para gestionar clientes, proyectos y entregables." />
            <Area label={t.budgetConstraints} value={budget} onChange={setBudget} minHeight="min-h-20" placeholder="Servicios gratuitos y open source en fase MVP." />
            {project?.status === "running" ? (
              <button type="button" onClick={() => stopProject(project.id)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-rose-700 active:scale-[0.98]">
                <MaterialIcon name="progress_activity" className="w-4 text-white" animate="spin" />
                Detener Proceso
              </button>
            ) : (
              <button disabled={isCreating} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-surface transition hover:translate-y-[-1px] active:scale-[0.98] disabled:opacity-50">
                {isCreating ? <MaterialIcon name="progress_activity" className="w-4 text-white" animate="spin" /> : <MaterialIcon name="play_arrow" className="w-4" />}
                {t.createRun}
              </button>
            )}
            {error ? <p className="rounded-lg bg-red-50 p-2 text-xs text-red-700">{error}</p> : null}
          </form>

          <div className="mt-4 quiet-card flex max-h-[350px] flex-col p-4">
            <SectionTitle icon={<MaterialIcon name="folder" className="w-4" />} title={t.projects} />
            {projects.length > 0 && (
              <div className="relative mt-3">
                <MaterialIcon name="search" className="absolute left-2.5 top-1/2 w-3.5 -translate-y-1/2 text-text-muted" style={{ transform: "translateY(-50%)" }} />
                <input type="text" placeholder={language === "es" ? "Buscar proyecto..." : "Search projects..."} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full rounded-md border border-line bg-surface py-1.5 pl-8 pr-3 text-xs text-text-strong placeholder:text-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand" />
              </div>
            )}
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              {projects.length === 0 ? <EmptyProjectState text={t.noProjects} /> : filteredProjects.length === 0 ? <EmptyProjectState text={language === "es" ? "Ningun proyecto coincide." : "No matching projects."} /> : (
                filteredProjects.map((item) => (
                  <div key={item.id} className={`group relative flex w-full items-center justify-between rounded-lg border text-left text-sm transition hover:shadow-sm ${project?.id === item.id ? "border-brand bg-brand/5" : "border-line bg-surface hover:border-[var(--line-strong)]"}`}>
                    <button onClick={() => setProject(item)} className="min-w-0 flex-1 p-3 text-left">
                      <div className="truncate font-semibold text-text-strong">{item.name}</div>
                      <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)]">
                        <span className={`h-1.5 w-1.5 rounded-full ${item.status === "completed" ? "bg-emerald-500" : item.status === "running" ? "bg-brand animate-pulse" : item.status === "failed" ? "bg-rose-500" : "bg-line-strong"}`} />
                        {item.status}
                      </div>
                    </button>
                    <div className="flex items-center">
                      <button type="button" onClick={(e) => { e.stopPropagation(); openWorkspace(item.id); }} className="mr-1 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-brand/10 hover:text-brand group-hover:opacity-100" title="Abrir Workspace">
                        <MaterialIcon name="folder_open" className="w-3.5" />
                      </button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setProjectToDelete({ id: item.id, name: item.name }); }} className="mr-2 rounded-md p-1.5 text-text-muted opacity-0 transition-opacity hover:bg-rose-500/10 hover:text-rose-600 group-hover:opacity-100" title="Eliminar proyecto">
                        <MaterialIcon name="delete" className="w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      )}
      {projectToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm rise-in" onClick={() => setProjectToDelete(null)}>
          <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-text-strong">Eliminar proyecto</h3>
            <p className="mt-2 text-sm text-text-muted">Estas seguro de que deseas eliminar el proyecto <span className="font-semibold text-text-strong">"{projectToDelete.name}"</span>? Esta accion no se puede deshacer.</p>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setProjectToDelete(null)} className="rounded-lg px-4 py-2 text-sm font-semibold text-text-muted transition hover:bg-surface-muted hover:text-text-strong">Cancelar</button>
              <button type="button" onClick={() => { deleteProject(projectToDelete.id); setProjectToDelete(null); }} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700">Eliminar</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function EmptyProjectState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-muted p-4 text-center">
      <p className="text-xs font-semibold text-text-muted">{text}</p>
    </div>
  );
}
