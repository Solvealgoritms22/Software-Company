import { FormEvent } from "react";

import { AgentGraph } from "../AgentGraph";
import { AgentWorld } from "../AgentWorld";
import { MaterialIcon } from "../MaterialIcon";
import { SpeakingIndicator } from "../SpeakingIndicator";
import type { useOrchestrator } from "../../hooks/useOrchestrator";
import { formatCompactNumber, formatUsd, MissionMetric } from "./utils";

type Orchestrator = ReturnType<typeof useOrchestrator>;

type Props = {
  project: Orchestrator["project"];
  registry: Orchestrator["agentRegistry"];
  projectTraces: Orchestrator["projectTraces"];
  phaseProgress: number;
  completedPhaseCount: number;
  runningPhase?: { id: string } | null;
  humanInboxCount: number;
  usageCost: number;
  failedNotice?: string | null;
  isMissionControlVisible: boolean;
  setMissionControlVisibility: (visible: boolean) => void;
  canvasView: "flow" | "office";
  setCanvasMode: (mode: "flow" | "office") => void;
  isCanvasMaximized: boolean;
  setIsCanvasMaximized: (value: boolean) => void;
  isLeftSidebarOpen: boolean;
  setIsLeftSidebarOpen: (value: boolean) => void;
  isRightSidebarOpen: boolean;
  setIsRightSidebarOpen: (value: boolean) => void;
  chatMessage: string;
  setChatMessage: (value: string) => void;
  isChatSending: boolean;
  setIsChatSending: (value: boolean) => void;
  sendChat: (id: string, message: string) => Promise<void>;
  voiceEnabled: boolean;
  voiceStatus: string;
  speakingAgentId?: string | null;
  setVoiceConversationMode: (enabled: boolean) => Promise<void>;
  theme: string;
};

export function FactoryCanvas({
  project,
  registry,
  projectTraces,
  phaseProgress,
  completedPhaseCount,
  runningPhase,
  humanInboxCount,
  usageCost,
  failedNotice,
  isMissionControlVisible,
  setMissionControlVisibility,
  canvasView,
  setCanvasMode,
  isCanvasMaximized,
  setIsCanvasMaximized,
  isLeftSidebarOpen,
  setIsLeftSidebarOpen,
  isRightSidebarOpen,
  setIsRightSidebarOpen,
  chatMessage,
  setChatMessage,
  isChatSending,
  setIsChatSending,
  sendChat,
  voiceEnabled,
  voiceStatus,
  speakingAgentId,
  setVoiceConversationMode,
  theme,
}: Props) {
  async function submitChat(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project || !chatMessage.trim() || isChatSending) return;
    setIsChatSending(true);
    try {
      await sendChat(project.id, chatMessage);
      setChatMessage("");
    } finally {
      setIsChatSending(false);
    }
  }

  return (
    <section className="min-w-0 surface-muted relative">
      <div className="relative h-full">
        <div className={`absolute inset-0 transition-opacity duration-300 ${canvasView === "flow" ? "z-10 opacity-100" : "pointer-events-none -z-10 opacity-0"}`}>
          <AgentGraph project={project} registry={registry} theme={theme} speakingAgentId={speakingAgentId} />
        </div>
        <div className={`absolute inset-0 transition-opacity duration-300 ${canvasView === "office" ? "z-10 opacity-100" : "pointer-events-none -z-10 opacity-0"}`}>
          <AgentWorld project={project} registry={registry} traces={projectTraces} speakingAgentId={speakingAgentId} />
        </div>

        {project ? (
          <div className="absolute bottom-28 left-4 z-10 w-[min(360px,calc(100%-2rem))]">
            {isMissionControlVisible ? (
              <div className="quiet-card border-line/70 bg-surface/90 p-2.5 shadow-md backdrop-blur-xl">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${project.status === "running" ? "bg-brand animate-pulse" : project.status === "completed" ? "bg-emerald-500" : project.status === "failed" || project.status === "waiting_intervention" ? "bg-rose-500" : "bg-amber-500"}`} />
                      <h2 className="truncate text-xs font-black text-text-strong">Mission Control</h2>
                    </div>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-text-muted">{project.name} - {project.status.replaceAll("_", " ")}</p>
                  </div>
                  <button type="button" onClick={() => setMissionControlVisibility(false)} className="rounded-md border border-line bg-surface px-1.5 py-1.5 text-text-muted shadow-sm transition hover:bg-surface-muted hover:text-text-strong" aria-label="Ocultar Mission Control" title="Ocultar">
                    <MaterialIcon name="visibility_off" className="w-3.5" />
                  </button>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(phaseProgress * 100, completedPhaseCount ? 4 : 0)}%` }} />
                </div>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  <MissionMetric label="Fase" value={(runningPhase?.id || project.current_phase || "idle").replaceAll("_", " ")} />
                  <MissionMetric label="Bloqueos" value={String(humanInboxCount)} tone={humanInboxCount ? "amber" : "default"} />
                  <MissionMetric label="Costo" value={formatUsd(usageCost)} />
                  <MissionMetric label="Eventos" value={formatCompactNumber(projectTraces.length)} />
                </div>
                <button type="button" onClick={() => void setVoiceConversationMode(!voiceEnabled)} className={`mt-2 flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-[10px] font-black transition ${voiceEnabled ? "border-brand/40 bg-brand/10 text-brand" : "border-line bg-surface text-text-muted hover:bg-surface-muted hover:text-text-strong"}`} title="Activar conversaciones por voz">
                  <span className="flex items-center gap-1.5"><SpeakingIndicator active={voiceEnabled && voiceStatus === "speaking"} />Voz de agentes</span>
                  <span className="text-[9px] uppercase text-text-muted">{voiceEnabled ? (voiceStatus === "backend_unavailable" ? "fallback" : "activo") : "off"}</span>
                </button>
                {failedNotice ? <div className="mt-2 truncate rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-700 dark:text-amber-400">{failedNotice}</div> : null}
              </div>
            ) : (
              <button type="button" onClick={() => setMissionControlVisibility(true)} className="inline-flex max-w-full items-center gap-2 rounded-lg border border-line bg-surface/90 px-2.5 py-2 text-xs font-black text-text-strong shadow-md backdrop-blur-xl transition hover:bg-surface hover:shadow-lg" aria-label="Mostrar Mission Control" title="Mostrar Mission Control">
                <MaterialIcon name="visibility" className="w-3.5 text-brand" />
                <span className="truncate">Mission Control</span>
                <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] text-text-muted">{Math.round(phaseProgress * 100)}%</span>
              </button>
            )}
          </div>
        ) : null}

        <div className="absolute right-16 top-4 z-10 flex rounded-lg border border-line bg-surface p-1 text-xs font-bold text-text-muted shadow-md">
          <CanvasModeButton active={canvasView === "flow"} icon="alt_route" label="Flow" onClick={() => setCanvasMode("flow")} />
          <CanvasModeButton active={canvasView === "office"} icon="smart_toy" label="Oficina" onClick={() => setCanvasMode("office")} />
        </div>
        <button type="button" onClick={() => setIsCanvasMaximized(!isCanvasMaximized)} className="absolute right-4 top-4 z-10 rounded-lg border border-line bg-surface p-2 text-text-muted shadow-md transition-all hover:text-text-strong hover:shadow-lg" aria-label={isCanvasMaximized ? "Restaurar canvas" : "Maximizar canvas"} title={isCanvasMaximized ? "Restaurar pantalla" : "Pantalla completa"}>
          {isCanvasMaximized ? <MaterialIcon name="close_fullscreen" className="w-4" /> : <MaterialIcon name="open_in_full" className="w-4" />}
        </button>
        {!isCanvasMaximized && !isLeftSidebarOpen ? <PanelToggle side="left" onClick={() => setIsLeftSidebarOpen(true)} /> : null}
        {project && !isCanvasMaximized && !isRightSidebarOpen ? <PanelToggle side="right" onClick={() => setIsRightSidebarOpen(true)} /> : null}

        {project ? (
          <div className="absolute bottom-10 left-1/2 z-20 w-full max-w-2xl -translate-x-1/2 px-4">
            <form className="relative flex items-center overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20" onSubmit={submitChat}>
              <input type="text" placeholder="Itera en este proyecto: solicita cambios, mejoras o correcciones..." value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} disabled={isChatSending || project.status === "failed"} className="w-full bg-transparent px-5 py-4 text-sm text-text-strong outline-none placeholder:text-text-muted disabled:opacity-50" />
              <button type="submit" disabled={!chatMessage.trim() || isChatSending || project.status === "failed"} className={`mr-2 flex items-center justify-center rounded-xl p-2 transition-all duration-300 ${chatMessage.trim() ? "bg-brand text-white shadow-md hover:scale-105 hover:bg-brand/90 hover:shadow-lg" : "cursor-not-allowed bg-[var(--surface-muted)] text-[var(--text-muted)]"}`} title="Enviar instruccion">
                {isChatSending ? <MaterialIcon name="progress_activity" className="w-5" animate="spin" /> : <MaterialIcon name="arrow_upward" className="w-5" />}
              </button>
            </form>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function CanvasModeButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition ${active ? "bg-brand text-white" : "hover:bg-surface-muted hover:text-text-strong"}`} aria-label={label} title={label}>
      <MaterialIcon name={icon} className="w-3.5" />
      {label}
    </button>
  );
}

function PanelToggle({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`absolute ${side === "left" ? "left-4 top-4" : "right-4 top-16"} z-10 rounded-lg border border-line bg-surface p-2 text-text-muted shadow-md transition-all hover:text-text-strong hover:shadow-lg`} aria-label={side === "left" ? "Mostrar panel izquierdo" : "Mostrar panel de logs"} title={side === "left" ? "Mostrar panel izquierdo" : "Mostrar panel de logs"}>
      <MaterialIcon name={side === "left" ? "chevron_right" : "chevron_left"} className="w-4" />
    </button>
  );
}
