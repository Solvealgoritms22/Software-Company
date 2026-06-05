"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import type { AgentRegistry, AgentTrace, ProjectState } from "../hooks/useOrchestrator";
import { SpeakingIndicator } from "./SpeakingIndicator";

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
  { x: 60, y: 18, zone: "Direccion", desk: "strategy", facing: "up" },
  { x: 79, y: 18, zone: "Descubrimiento", desk: "research", facing: "up" },
  { x: 36, y: 36, zone: "Legal", desk: "review", facing: "down" },
  { x: 54, y: 36, zone: "Aprobacion", desk: "meeting", facing: "down" },
  { x: 72, y: 36, zone: "Arquitectura", desk: "blueprint", facing: "down" },
  { x: 20, y: 56, zone: "Backend", desk: "code", facing: "down" },
  { x: 38, y: 56, zone: "Frontend", desk: "ui", facing: "down" },
  { x: 56, y: 56, zone: "Datos", desk: "database", facing: "down" },
  { x: 74, y: 56, zone: "QA", desk: "test", facing: "down" },
  { x: 88, y: 56, zone: "Entrega", desk: "release", facing: "down" },
  { x: 28, y: 78, zone: "Seguridad", desk: "shield", facing: "down" },
  { x: 46, y: 78, zone: "DevOps", desk: "deploy", facing: "down" },
  { x: 64, y: 78, zone: "Docs", desk: "docs", facing: "down" },
  { x: 82, y: 78, zone: "Cierre", desk: "done", facing: "down" },
  { x: 92, y: 78, zone: "Soporte", desk: "support", facing: "down" },
];

const statusCopy: Record<string, string> = {
  pending: "esperando",
  running: "trabajando",
  completed: "listo",
  failed: "bloqueado",
};

const shirtPalette = [
  "#2563eb",
  "#0d9488",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#16a34a",
  "#9333ea",
  "#475569",
];

function hashString(value: string) {
  return value.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function normalizeSexo(value?: string) {
  const text = (value || "no_especificado").toLowerCase();
  if (text.startsWith("f")) return "femenino";
  if (text.startsWith("m")) return "masculino";
  return "no_especificado";
}

function miniverseState(status: string, projectStatus?: string) {
  if (status === "running") return "working";
  if (status === "failed" || projectStatus === "waiting_intervention") return "error";
  if (projectStatus === "waiting_approval") return "thinking";
  if (status === "completed") return "idle";
  return "idle";
}

function statusIcon(status: string, projectStatus?: string) {
  if (status === "running") {
    return <span className="material-symbols-outlined w-3.5 h-3.5">bolt</span>;
  }
  if (status === "completed") {
    return <span className="material-symbols-outlined w-3.5 h-3.5">check_circle</span>;
  }
  if (status === "failed" || projectStatus === "waiting_intervention") {
    return <span className="material-symbols-outlined w-3.5 h-3.5 text-danger">warning</span>;
  }
  if (projectStatus === "waiting_approval") {
    return <span className="material-symbols-outlined w-3.5 h-3.5">chat</span>;
  }
  return <span className="material-symbols-outlined w-3.5 h-3.5">circle</span>;
}

function compactTask(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 96);
}

const PixelPerson = memo(function PixelPerson({
  sexo,
  status,
  color,
  facing = "down",
}: {
  sexo: string;
  status: string;
  color: string;
  facing?: string;
}) {
  const feminine = sexo === "femenino";
  const neutral = sexo === "no_especificado";
  const hair = feminine ? "#2f1b16" : neutral ? "#334155" : "#1f2937";
  const skin = feminine ? "#d9a171" : neutral ? "#c08a64" : "#b87956";
  const moving = status === "running";
  const blocked = status === "failed";
  const asleep = status === "pending";
  const topFacing = facing === "up";

  return (
    <div className={`relative h-[68px] w-[56px] [image-rendering:pixelated] ${moving ? "animate-[agent-bob_0.7s_steps(2,end)_infinite]" : ""}`}>
      <div className="absolute left-[6px] top-[28px] h-[34px] w-[44px] bg-[#22202a]" />
      <div className="absolute left-[10px] top-[32px] h-[28px] w-[36px] bg-[#34313f]" />
      <div className="absolute left-[14px] top-[58px] h-[10px] w-[8px] bg-[#1b2638]" />
      <div className="absolute right-[14px] top-[58px] h-[10px] w-[8px] bg-[#1b2638]" />
      <div className="absolute left-[18px] top-[7px] h-[24px] w-[20px]" style={{ background: skin }} />
      <div className="absolute left-[14px] top-[5px] h-[10px] w-[28px]" style={{ background: hair }} />
      <div className="absolute left-[12px] top-[13px] h-[14px] w-[8px]" style={{ background: hair }} />
      <div className="absolute right-[12px] top-[13px] h-[14px] w-[8px]" style={{ background: hair }} />
      {feminine ? <div className="absolute left-[10px] top-[22px] h-[12px] w-[8px]" style={{ background: hair }} /> : null}
      {feminine ? <div className="absolute right-[10px] top-[22px] h-[12px] w-[8px]" style={{ background: hair }} /> : null}
      {!topFacing ? (
        <>
          <div className="absolute left-[21px] top-[20px] h-[3px] w-[3px] bg-slate-950" />
          <div className="absolute right-[21px] top-[20px] h-[3px] w-[3px] bg-slate-950" />
          <div className="absolute left-[24px] top-[27px] h-[3px] w-[8px] bg-rose-900/70" />
        </>
      ) : null}
      <div className="absolute left-[12px] top-[34px] h-[20px] w-[32px]" style={{ background: color }} />
      <div className="absolute left-[7px] top-[37px] h-[10px] w-[10px]" style={{ background: color }} />
      <div className="absolute right-[7px] top-[37px] h-[10px] w-[10px]" style={{ background: color }} />
      <div className="absolute left-[6px] top-[46px] h-[7px] w-[11px]" style={{ background: skin }} />
      <div className="absolute right-[6px] top-[46px] h-[7px] w-[11px]" style={{ background: skin }} />
      {moving ? <div className="absolute -right-[4px] top-[8px] h-[7px] w-[7px] bg-brand" /> : null}
      {blocked ? <div className="absolute -right-[7px] top-[2px] h-[9px] w-[9px] bg-danger" /> : null}
      {asleep ? (
        <div className="absolute -right-[12px] -top-[8px] text-[10px] font-black text-text-muted">
          z
        </div>
      ) : null}
    </div>
  );
});

const PixelDesk = memo(function PixelDesk({ type, facing = "down" }: { type: string; facing?: string }) {
  const accent = type === "shield" ? "#dc2626" : type === "deploy" ? "#0d9488" : type === "database" ? "#7c3aed" : "#2563eb";
  const topFacing = facing === "up";
  return (
    <div className={`absolute left-1/2 h-[72px] w-[122px] -translate-x-1/2 [image-rendering:pixelated] ${topFacing ? "top-[-18px]" : "top-[40px]"}`}>
      <div className="absolute inset-x-[7px] bottom-[3px] h-[10px] bg-black/25" />
      <div className="absolute left-[6px] top-[8px] h-[44px] w-[110px] border-[3px] border-[#2b1b19] bg-[#d7d2c4]" />
      <div className="absolute left-[10px] top-[12px] h-[7px] w-[102px] bg-white/35" />
      <div className="absolute bottom-[15px] left-[11px] h-[14px] w-[8px] bg-[#6f4a35]" />
      <div className="absolute bottom-[15px] right-[11px] h-[14px] w-[8px] bg-[#6f4a35]" />
      <div className="absolute left-[38px] top-[-5px] h-[23px] w-[46px] border-[3px] border-[#24181d] bg-[#24202c]" />
      <div className="absolute left-[44px] top-0 h-[13px] w-[34px] bg-[#111827]" />
      <div className="absolute left-[52px] top-[20px] h-[5px] w-[18px] bg-[#24181d]" />
      <div className="absolute left-[35px] top-[31px] h-[7px] w-[52px] border border-[#9a8f82] bg-[#eee7d8]" />
      <div className="absolute right-[18px] top-[27px] h-[14px] w-[16px]" style={{ background: accent }} />
      <div className="absolute right-[21px] top-[30px] h-[4px] w-[10px] bg-white/50" />
    </div>
  );
});

const PixelArmchair = memo(function PixelArmchair({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute h-[88px] w-[86px] [image-rendering:pixelated] ${className}`}>
      <div className="absolute inset-x-[7px] bottom-[2px] h-[10px] bg-black/25" />
      <div className="absolute left-[14px] top-[12px] h-[56px] w-[58px] border-[3px] border-[#7a551e] bg-[#b8902b]" />
      <div className="absolute left-[6px] top-[30px] h-[34px] w-[16px] border-[3px] border-[#7a551e] bg-[#c6a33b]" />
      <div className="absolute right-[6px] top-[30px] h-[34px] w-[16px] border-[3px] border-[#7a551e] bg-[#c6a33b]" />
      <div className="absolute left-[18px] top-[45px] h-[15px] w-[50px] bg-[#a57b21]" />
      <div className="absolute left-[15px] bottom-[4px] h-[10px] w-[8px] bg-[#5f3b1f]" />
      <div className="absolute right-[15px] bottom-[4px] h-[10px] w-[8px] bg-[#5f3b1f]" />
    </div>
  );
});

const PixelCoffeeTable = memo(function PixelCoffeeTable() {
  return (
    <div className="absolute bottom-[8%] left-[63%] h-[78px] w-[190px] -translate-x-1/2 [image-rendering:pixelated]">
      <div className="absolute inset-x-[10px] bottom-[3px] h-[10px] bg-black/25" />
      <div className="absolute inset-x-0 top-[8px] h-[46px] border-[3px] border-[#6f4a35] bg-[#e2ded0]" />
      <div className="absolute inset-x-[7px] top-[13px] h-[8px] bg-white/35" />
      <div className="absolute left-[78px] top-[-4px] h-[28px] w-[28px] border-[3px] border-[#8d8a7a] bg-[#d8d6c5]" />
      <div className="absolute left-[83px] top-[-19px] h-[18px] w-[5px] bg-[#3f6b52]" />
      <div className="absolute left-[92px] top-[-19px] h-[18px] w-[5px] bg-[#5d8b68]" />
      <div className="absolute left-[75px] top-[-13px] h-[12px] w-[8px] bg-[#47785a]" />
      <div className="absolute left-[98px] top-[-13px] h-[12px] w-[8px] bg-[#47785a]" />
      <div className="absolute bottom-0 left-[18px] h-[18px] w-[9px] bg-[#4a3426]" />
      <div className="absolute bottom-0 right-[18px] h-[18px] w-[9px] bg-[#4a3426]" />
    </div>
  );
});

const PixelRug = memo(function PixelRug() {
  return (
    <div className="absolute bottom-[12%] left-[15%] h-[146px] w-[230px] [image-rendering:pixelated]">
      <div className="absolute inset-0 border-[4px] border-[#766f6b] bg-[#d8d2c3]" />
      <div className="absolute inset-[12px] border-[3px] border-[#8b8580] bg-[#c8c0b3]" />
      <div className="absolute left-[46px] top-[34px] h-[60px] w-[60px] rotate-45 border-[4px] border-[#85817a] bg-[#aaa49a]" />
      <div className="absolute right-[46px] top-[34px] h-[60px] w-[60px] rotate-45 border-[4px] border-[#85817a] bg-[#aaa49a]" />
      <div className="absolute left-[26px] top-[70px] h-[8px] w-[18px] bg-[#6f6b65]" />
      <div className="absolute left-[126px] top-[70px] h-[8px] w-[18px] bg-[#6f6b65]" />
    </div>
  );
});

export const AgentWorld = memo(function AgentWorld({
  project,
  registry,
  traces,
  speakingAgentId,
}: {
  project: ProjectState | null;
  registry: AgentRegistry | null;
  traces: AgentTrace[];
  speakingAgentId?: string | null;
}) {
  const agents = registry?.agents || {};
  const miniverseUrl = process.env.NEXT_PUBLIC_MINIVERSE_URL?.replace(/\/$/, "");
  const sentEventFingerprints = useRef(new Map<string, string>());

  const tracesByPhase = useMemo(() => {
    const byPhase = new Map<string, AgentTrace>();
    for (const trace of traces) {
      if (!byPhase.has(trace.phase)) {
        byPhase.set(trace.phase, trace);
      }
    }
    return byPhase;
  }, [traces]);

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
        const latest = tracesByPhase.get(phase.id);
        const metadata = latest?.metadata || {};
        const summary = typeof metadata.summary === "string" ? metadata.summary : "";
        const task = compactTask(phase.error || summary || `${phase.id.replaceAll("_", " ")} ${statusCopy[phase.status] || phase.status}`);
        const name = agent.name || phase.agent.replaceAll("_", " ");
        const sexo = normalizeSexo(agent.sexo);
        return {
          id: phase.id,
          agentId: phase.agent,
          agentName: name,
          role: agent.display_name || "Agent",
          avatar: agent.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`,
          sexo,
          spriteColor: shirtPalette[hashString(phase.agent) % shirtPalette.length],
          status: phase.status,
          worldState: miniverseState(phase.status, project.status),
          task,
          zone: slot.zone,
          desk: slot.desk,
          facing: slot.facing,
          x: slot.x,
          y: slot.y,
        };
      });
  }, [agents, project, tracesByPhase]);

  const residentStats = useMemo(() => ({
    running: residents.filter((resident) => resident.status === "running").length,
    blocked: residents.filter((resident) => resident.status === "failed").length,
    completed: residents.filter((resident) => resident.status === "completed").length,
  }), [residents]);

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
    const events = Array.from(uniqueByAgent.values()).filter((resident) => {
      const fingerprint = [project.id, resident.agentId, resident.worldState].join(":");
      const previous = sentEventFingerprints.current.get(resident.agentId);
      if (previous === fingerprint) return false;
      sentEventFingerprints.current.set(resident.agentId, fingerprint);
      return true;
    });
    void Promise.all(
      events.map((resident) =>
        fetch(`${miniverseUrl}/api/heartbeat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: resident.agentId,
            name: resident.agentName,
            state: resident.worldState,
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

  if (miniverseUrl) {
    return (
      <div className="w-full h-full min-h-[640px] relative bg-[#111827]">
        <iframe
          src={miniverseUrl}
          className="w-full h-full absolute inset-0 border-none"
          title="Miniverse Office"
        />
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[640px] overflow-hidden bg-[#17100f]">
      <style>{`
        @keyframes agent-bob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        @keyframes screen-pulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }
      `}</style>

      <div className="absolute inset-0 bg-[#392824]" />
      <div className="absolute inset-0 opacity-95 [image-rendering:pixelated] [background-image:linear-gradient(0deg,rgba(21,12,13,.85)_3px,transparent_3px),linear-gradient(90deg,rgba(21,12,13,.65)_3px,transparent_3px),linear-gradient(90deg,transparent_0_88px,rgba(255,255,255,.05)_88px_91px,transparent_91px_180px)] [background-size:180px_44px,92px_44px,180px_44px]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_55%_8%,rgba(255,228,184,.20),transparent_34%),radial-gradient(circle_at_15%_76%,rgba(255,227,170,.12),transparent_28%)]" />
      <div className="absolute inset-x-0 top-0 h-[7%] border-b-[4px] border-[#241819] bg-[#4a3732]" />
      <div className="absolute left-[8%] top-[1.5%] h-[4%] w-[16%] border-[3px] border-[#201719] bg-[#d8d7cf]/80" />
      <div className="absolute right-[15%] top-[1.5%] h-[4%] w-[18%] border-[3px] border-[#201719] bg-[#d8d7cf]/80" />

      <PixelRug />
      <PixelArmchair className="bottom-[58%] left-[3%]" />
      <PixelArmchair className="bottom-[28%] left-[28%]" />
      <PixelCoffeeTable />

      <div className="absolute left-4 top-4 z-20 border border-[#2b1b19] bg-[#f4efe2]/95 p-2.5 shadow-lg backdrop-blur dark:bg-[#211b1d]/95">
        <div className="flex items-center gap-2 text-xs font-black text-text-strong">
          <span className="h-2 w-2 bg-brand" />
          Oficina pixel
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5 text-[10px] font-bold">
          <span className="bg-brand/10 px-2 py-1 text-brand">{residentStats.running} activos</span>
          <span className="bg-success/10 px-2 py-1 text-success">{residentStats.completed} listos</span>
          <span className="bg-danger/10 px-2 py-1 text-danger">{residentStats.blocked} bloqueos</span>
        </div>
      </div>

      {miniverseUrl ? (
        <div className="absolute bottom-4 right-4 z-20 border border-[#2b1b19] bg-[#f4efe2]/95 px-3 py-2 text-[11px] font-bold text-text-muted shadow-lg backdrop-blur dark:bg-[#211b1d]/95">
          Miniverse sync activo
        </div>
      ) : null}

      {residents.map((resident) => (
        <div
          key={resident.id}
          className="absolute z-10 w-[132px] -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${resident.x}%`, top: `${resident.y}%` }}
        >
          <PixelDesk type={resident.desk} facing={resident.facing} />
          <div className={`relative mx-auto flex h-[92px] w-[80px] items-start justify-center ${resident.facing === "up" ? "pt-[18px]" : "pt-[4px]"}`}>
            <PixelPerson sexo={resident.sexo} status={resident.status} color={resident.spriteColor} facing={resident.facing} />
            {speakingAgentId === resident.agentId ? (
              <span className="absolute -right-2 top-1 z-30">
                <SpeakingIndicator active size="sm" />
              </span>
            ) : null}
          </div>
          <div className="relative z-10 mx-auto w-[112px] border border-[#2b1b19] bg-[#f4efe2]/95 px-2 py-1 text-center shadow-sm dark:bg-[#211b1d]/95">
            <div className="truncate text-[10px] font-black text-text-strong">{resident.agentName}</div>
            <div className="mt-0.5 flex items-center justify-center gap-1 text-[9px] font-bold uppercase text-text-muted">
              {statusIcon(resident.status, project.status)}
              <span className="truncate">{statusCopy[resident.status] || resident.status}</span>
            </div>
          </div>
          {resident.status === "running" || resident.status === "failed" ? (
            <div className="relative z-20 mx-auto mt-1 max-h-[42px] w-[126px] overflow-hidden border border-[#2b1b19] bg-[#f4efe2]/95 px-2 py-1 text-[10px] font-semibold leading-snug text-text-muted shadow-sm dark:bg-[#211b1d]/95">
              {resident.task}
            </div>
          ) : resident.status === "pending" ? (
            <div className="relative z-10 mx-auto mt-1 flex w-fit items-center gap-1 border border-[#2b1b19] bg-[#f4efe2]/90 px-2 py-1 text-[10px] font-semibold text-text-muted dark:bg-[#211b1d]/90">
              <span className="material-symbols-outlined h-3 w-3">dark_mode</span>
              cola
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
});
