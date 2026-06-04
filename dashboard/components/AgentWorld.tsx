"use client";

import { useEffect, useMemo } from "react";
import { AlertTriangle, CheckCircle2, Circle, Clock, MessageSquare, Moon, Zap } from "lucide-react";
import type { AgentRegistry, AgentTrace, ProjectState } from "../hooks/useOrchestrator";

const phaseOrder = [
  "ceo",
  "analysis",
  "legal_contract",
  "founder_approval",
  "architecture",
  "senior_backend",
  "backend_development",
  "frontend_architecture",
  "frontend_development",
  "database",
  "qa",
  "security",
  "devops",
  "documentation",
  "done",
];

const officeSlots = [
  { x: 10, y: 18, zone: "Direccion" },
  { x: 26, y: 16, zone: "Descubrimiento" },
  { x: 42, y: 17, zone: "Legal" },
  { x: 58, y: 16, zone: "Aprobacion" },
  { x: 75, y: 18, zone: "Arquitectura" },
  { x: 18, y: 49, zone: "Backend" },
  { x: 35, y: 50, zone: "Frontend" },
  { x: 52, y: 50, zone: "Datos" },
  { x: 69, y: 50, zone: "QA" },
  { x: 84, y: 49, zone: "Entrega" },
  { x: 25, y: 77, zone: "Seguridad" },
  { x: 45, y: 78, zone: "DevOps" },
  { x: 65, y: 77, zone: "Docs" },
  { x: 82, y: 77, zone: "Cierre" },
  { x: 10, y: 77, zone: "Soporte" },
];

const statusCopy: Record<string, string> = {
  pending: "esperando",
  running: "trabajando",
  completed: "listo",
  failed: "bloqueado",
};

function miniverseState(status: string, projectStatus?: string) {
  if (status === "running") return "working";
  if (status === "failed" || projectStatus === "waiting_intervention") return "error";
  if (projectStatus === "waiting_approval") return "thinking";
  if (status === "completed") return "idle";
  return "idle";
}

function statusIcon(status: string, projectStatus?: string) {
  if (status === "running") return <Zap className="h-3.5 w-3.5" />;
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5" />;
  if (status === "failed" || projectStatus === "waiting_intervention") return <AlertTriangle className="h-3.5 w-3.5" />;
  if (projectStatus === "waiting_approval") return <MessageSquare className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5" />;
}

function statusTone(status: string, projectStatus?: string) {
  if (status === "running") return "border-brand bg-brand/10 text-brand shadow-[0_0_0_1px_rgba(37,99,235,0.18)]";
  if (status === "completed") return "border-success/40 bg-success/10 text-success";
  if (status === "failed" || projectStatus === "waiting_intervention") return "border-danger/40 bg-danger/10 text-danger";
  if (projectStatus === "waiting_approval") return "border-amber-500/40 bg-amber-500/10 text-amber-600";
  return "border-line bg-surface/90 text-text-muted";
}

function latestPhaseTrace(traces: AgentTrace[], phaseId: string) {
  return traces.find((trace) => trace.phase === phaseId);
}

export function AgentWorld({
  project,
  registry,
  traces,
}: {
  project: ProjectState | null;
  registry: AgentRegistry | null;
  traces: AgentTrace[];
}) {
  const agents = registry?.agents || {};
  const miniverseUrl = process.env.NEXT_PUBLIC_MINIVERSE_URL?.replace(/\/$/, "");

  const residents = useMemo(() => {
    if (!project) return [];
    const phases = Object.values(project.phases);
    return phases
      .sort((a, b) => {
        const left = phaseOrder.indexOf(a.id);
        const right = phaseOrder.indexOf(b.id);
        return (left === -1 ? 999 : left) - (right === -1 ? 999 : right);
      })
      .map((phase, index) => {
        const agent = agents[phase.agent] || {};
        const slot = officeSlots[index % officeSlots.length];
        const latest = latestPhaseTrace(traces, phase.id);
        const metadata = latest?.metadata || {};
        const summary = typeof metadata.summary === "string" ? metadata.summary : "";
        const task = phase.error || summary || `${phase.id.replaceAll("_", " ")} ${statusCopy[phase.status] || phase.status}`;
        const name = agent.name || phase.agent.replaceAll("_", " ");
        return {
          id: phase.id,
          agentId: phase.agent,
          agentName: name,
          role: agent.display_name || "Agent",
          avatar: agent.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          status: phase.status,
          worldState: miniverseState(phase.status, project.status),
          task,
          zone: slot.zone,
          x: slot.x,
          y: slot.y,
        };
      });
  }, [agents, project, traces]);

  useEffect(() => {
    if (!miniverseUrl || !project || residents.length === 0) return;
    const controller = new AbortController();
    const uniqueByAgent = new Map<string, (typeof residents)[number]>();
    for (const resident of residents) {
      const existing = uniqueByAgent.get(resident.agentId);
      if (!existing || resident.status === "running" || resident.status === "failed") {
        uniqueByAgent.set(resident.agentId, resident);
      }
    }
    void Promise.all(
      Array.from(uniqueByAgent.values()).map((resident) =>
        fetch(`${miniverseUrl}/api/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: resident.agentId,
            name: resident.agentName,
            state: resident.worldState,
            task: resident.task,
            metadata: {
              project_id: project.id,
              project_name: project.name,
              phase: resident.id,
              avatar_url: resident.avatar,
            },
          }),
          signal: controller.signal,
        }).catch(() => undefined)
      )
    );
    return () => controller.abort();
  }, [miniverseUrl, project, residents]);

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm font-medium text-text-muted">
        Crea un proyecto y la oficina de agentes aparecera aqui.
      </div>
    );
  }

  const runningCount = residents.filter((resident) => resident.status === "running").length;
  const blockedCount = residents.filter((resident) => resident.status === "failed").length;
  const completedCount = residents.filter((resident) => resident.status === "completed").length;

  return (
    <div className="relative h-full min-h-[640px] overflow-hidden bg-surface-muted">
      {miniverseUrl ? (
        <div className="absolute bottom-4 right-4 z-20 rounded-lg border border-line bg-surface/95 px-3 py-2 text-[11px] font-bold text-text-muted shadow-lg backdrop-blur">
          Miniverse sync activo
        </div>
      ) : null}

      <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:32px_32px]" />
      <div className="absolute inset-x-8 top-24 h-[70%] rounded-[4px] border border-line bg-surface shadow-sm">
        <div className="absolute inset-0 [background-image:linear-gradient(90deg,transparent_0_31px,var(--line)_31px_32px),linear-gradient(transparent_0_31px,var(--line)_31px_32px)] [background-size:32px_32px] opacity-35" />
        <div className="absolute left-[6%] top-[8%] h-16 w-28 rounded-[3px] border border-line bg-surface-muted" />
        <div className="absolute right-[8%] top-[9%] h-14 w-32 rounded-[3px] border border-line bg-surface-muted" />
        <div className="absolute bottom-[8%] left-[38%] h-12 w-44 rounded-[3px] border border-line bg-surface-muted" />
      </div>

      <div className="absolute left-4 top-4 z-10 rounded-lg border border-line bg-surface/95 p-3 shadow-lg backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-black text-text-strong">
          <span className="h-2 w-2 rounded-full bg-brand" />
          Oficina de agentes
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] font-bold">
          <span className="rounded-md bg-brand/10 px-2 py-1 text-brand">{runningCount} activos</span>
          <span className="rounded-md bg-success/10 px-2 py-1 text-success">{completedCount} listos</span>
          <span className="rounded-md bg-danger/10 px-2 py-1 text-danger">{blockedCount} bloqueos</span>
        </div>
      </div>

      {residents.map((resident) => (
        <div
          key={resident.id}
          className="absolute z-10 w-40 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${resident.x}%`, top: `${resident.y}%` }}
        >
          <div className={`rounded-lg border p-2 shadow-sm backdrop-blur-sm transition ${statusTone(resident.status, project.status)}`}>
            <div className="flex items-center gap-2">
              <div className="relative h-9 w-9 shrink-0">
                <img
                  src={resident.avatar}
                  alt={resident.agentName}
                  className="h-9 w-9 rounded-[3px] border border-line bg-surface object-cover"
                />
                {resident.status === "running" ? (
                  <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-brand shadow-[0_0_0_3px_var(--surface)]" />
                ) : null}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[11px] font-black text-text-strong">{resident.agentName}</div>
                <div className="truncate text-[9px] font-bold uppercase text-text-muted">{resident.zone}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold">
              {statusIcon(resident.status, project.status)}
              <span className="truncate">{statusCopy[resident.status] || resident.status}</span>
            </div>
          </div>
          {resident.status === "running" || resident.status === "failed" ? (
            <div className="mt-1 rounded-md border border-line bg-surface/95 px-2 py-1 text-[10px] font-semibold leading-snug text-text-muted shadow-sm">
              {resident.task}
            </div>
          ) : resident.status === "pending" ? (
            <div className="mx-auto mt-1 flex w-fit items-center gap-1 rounded-md bg-surface/80 px-2 py-1 text-[10px] font-semibold text-text-muted">
              <Moon className="h-3 w-3" />
              cola
            </div>
          ) : null}
        </div>
      ))}

    </div>
  );
}
