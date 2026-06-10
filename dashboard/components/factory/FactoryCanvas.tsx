import { FormEvent } from "react";

import { AgentGraph } from "../AgentGraph";
import { ProjectChat } from "./ProjectChat";
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
  canvasView: "flow" | "chat";
  setCanvasMode: (mode: "flow" | "chat") => void;
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
        <div className={`absolute inset-0 transition-opacity duration-300 ${canvasView === "chat" ? "z-10 opacity-100" : "pointer-events-none -z-10 opacity-0"}`}>
          <ProjectChat 
            project={project} 
            registry={registry} 
            chatMessage={chatMessage}
            setChatMessage={setChatMessage}
            isChatSending={isChatSending}
            setIsChatSending={setIsChatSending}
            sendChat={sendChat}
          />
        </div>



        <div className="absolute right-4 top-4 z-10 flex rounded-lg border border-line bg-surface p-1 text-xs font-bold text-text-muted shadow-md">
          <CanvasModeButton active={canvasView === "flow"} icon="alt_route" label="Flow" onClick={() => setCanvasMode("flow")} />
          <CanvasModeButton active={canvasView === "chat"} icon="forum" label="Chat" onClick={() => setCanvasMode("chat")} />
        </div>
        {!isCanvasMaximized && !isLeftSidebarOpen ? <PanelToggle side="left" onClick={() => setIsLeftSidebarOpen(true)} /> : null}
        {project && !isCanvasMaximized && !isRightSidebarOpen ? <PanelToggle side="right" onClick={() => setIsRightSidebarOpen(true)} /> : null}

        {/* Chat input moved to ProjectChat component */}
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
