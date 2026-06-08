"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import type { ProjectArtifact, useOrchestrator } from "../hooks/useOrchestrator";
import { useAgentVoice } from "../hooks/useAgentVoice";
import { ArtifactDetailPanel, RollbackConfirmModal } from "./factory/ArtifactDetailPanel";
import { FactoryCanvas } from "./factory/FactoryCanvas";
import { FactoryLeftPanel } from "./factory/FactoryLeftPanel";
import { FactoryRightPanel } from "./factory/FactoryRightPanel";
import { factoryTranslations } from "./factory/translations";
import { asRecord, asString } from "./factory/utils";

type Orchestrator = ReturnType<typeof useOrchestrator>;

type FactoryViewProps = {
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
  sendChat: (id: string, message: string) => Promise<void>;
  retryProject: (id: string) => Promise<void>;
  rollbackPhase: (projectId: string, phaseId: string) => Promise<void>;
  approveContract: Orchestrator["approveContract"];
  registry: Orchestrator["agentRegistry"];
  mcpSecrets: Orchestrator["mcpSecrets"];
  streamBuffers: Record<string, string>;
  projectTraces: Orchestrator["projectTraces"];
  projectUsage: Orchestrator["projectUsage"];
  toolApprovals: Orchestrator["toolApprovals"];
  decideToolApproval: Orchestrator["decideToolApproval"];
  settings: Orchestrator["settings"];
  updateSettings: Orchestrator["updateSettings"];
  language: string;
  theme: string;
};

export function FactoryView(props: FactoryViewProps) {
  const {
    name, setName, goal, setGoal, budget, setBudget, onSubmit, isCreating, error,
    projects, project, setProject, deleteProject, stopProject, openWorkspace, sendChat,
    retryProject, rollbackPhase, approveContract, registry, mcpSecrets, streamBuffers,
    projectTraces, projectUsage, toolApprovals, decideToolApproval, settings, updateSettings,
    language, theme,
  } = props;

  const [selectedArtifact, setSelectedArtifact] = useState<ProjectArtifact | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [isCanvasMaximized, setIsCanvasMaximized] = useState(false);
  const [canvasView, setCanvasView] = useState<"flow" | "office">("flow");
  const [isMissionControlVisible, setIsMissionControlVisible] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [phaseToRollback, setPhaseToRollback] = useState<string | null>(null);
  const [chatMessage, setChatMessage] = useState("");
  const [isChatSending, setIsChatSending] = useState(false);
  const [replayPhase, setReplayPhase] = useState("all");

  useEffect(() => {
    const savedCanvas = localStorage.getItem("software-company-canvas-view");
    if (savedCanvas === "flow" || savedCanvas === "office") setCanvasView(savedCanvas);
    if (localStorage.getItem("software-company-mission-control") === "hidden") setIsMissionControlVisible(false);
    if (localStorage.getItem("software-company-voice-conversations") === "enabled") setVoiceEnabled(true);
  }, []);

  useEffect(() => {
    if (settings?.voice_conversations_enabled) setVoiceEnabled(true);
  }, [settings?.voice_conversations_enabled]);

  const agents = registry?.agents || {};
  const t = factoryTranslations[language as "en" | "es"] || factoryTranslations.en;
  const { speakingAgentId, voiceStatus } = useAgentVoice({ enabled: voiceEnabled, project, registry, language });

  const phaseList = useMemo(() => project ? Object.values(project.phases) : [], [project]);
  const completedPhaseCount = useMemo(() => phaseList.filter((phase) => phase.status === "completed").length, [phaseList]);
  const runningPhase = useMemo(() => phaseList.find((phase) => phase.status === "running"), [phaseList]);
  const failedPhase = useMemo(() => phaseList.find((phase) => phase.status === "failed" || phase.error), [phaseList]);
  const pendingToolApprovals = useMemo(() => toolApprovals.filter((approval) => approval.status === "pending"), [toolApprovals]);
  const missingSecrets = useMemo(() => Object.values(mcpSecrets?.secrets || {}).filter((secret) => !secret.configured), [mcpSecrets]);
  const failedReplayEvents = useMemo(() => projectTraces.filter((trace) => {
    const metadata = asRecord(trace.metadata) || {};
    const status = asString(metadata.status).toLowerCase();
    return status.includes("fail") || status.includes("error") || Boolean(metadata.error);
  }), [projectTraces]);
  const humanInboxItems = useMemo(() => buildHumanInbox(project, failedPhase?.error || null, pendingToolApprovals, missingSecrets), [failedPhase?.error, missingSecrets, pendingToolApprovals, project]);
  const replayPhases = useMemo(() => Array.from(new Set(projectTraces.map((trace) => trace.phase))).filter(Boolean), [projectTraces]);
  const replayEvents = useMemo(() => projectTraces
    .filter((trace) => replayPhase === "all" || trace.phase === replayPhase)
    .slice()
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()), [projectTraces, replayPhase]);

  const completedRatio = phaseList.length ? completedPhaseCount / phaseList.length : 0;
  const usageBudget = projectUsage?.budget;
  const usageRatio = Math.min(Math.max(usageBudget?.usage_ratio || 0, 0), 1);
  const contextEconomy = projectUsage?.context_economy;
  const failedNotice = usageBudget?.is_exceeded
    ? "Presupuesto IA alcanzado."
    : failedPhase?.error || (failedReplayEvents.length ? `${failedReplayEvents.length} evento(s) fallidos recientes.` : null);
  const hasRightSidebar = project && isRightSidebarOpen;
  const gridClass = isCanvasMaximized
    ? "grid-cols-1"
    : isLeftSidebarOpen
      ? hasRightSidebar
        ? "grid-cols-1 xl:grid-cols-[minmax(280px,340px)_minmax(0,1fr)_minmax(320px,380px)]"
        : "grid-cols-1 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
      : hasRightSidebar
        ? "grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)]"
        : "grid-cols-1";

  function setCanvasMode(mode: "flow" | "office") {
    setCanvasView(mode);
    localStorage.setItem("software-company-canvas-view", mode);
  }

  function setMissionControlVisibility(visible: boolean) {
    setIsMissionControlVisible(visible);
    localStorage.setItem("software-company-mission-control", visible ? "visible" : "hidden");
  }

  async function setVoiceConversationMode(enabled: boolean) {
    setVoiceEnabled(enabled);
    localStorage.setItem("software-company-voice-conversations", enabled ? "enabled" : "disabled");
    if (settings) await updateSettings({ ...settings, voice_conversations_enabled: enabled });
  }

  return (
    <section className={`relative grid h-[calc(100vh-73px)] ${gridClass}`}>
      <FactoryLeftPanel t={t} language={language} name={name} setName={setName} goal={goal} setGoal={setGoal} budget={budget} setBudget={setBudget} onSubmit={onSubmit} isCreating={isCreating} error={error} projects={projects} project={project} setProject={setProject} deleteProject={deleteProject} stopProject={stopProject} openWorkspace={openWorkspace} isOpen={!isCanvasMaximized && isLeftSidebarOpen} setIsOpen={setIsLeftSidebarOpen} searchQuery={projectSearchQuery} setSearchQuery={setProjectSearchQuery} projectToDelete={projectToDelete} setProjectToDelete={setProjectToDelete} />
      <FactoryCanvas project={project} registry={registry} projectTraces={projectTraces} phaseProgress={completedRatio} completedPhaseCount={completedPhaseCount} runningPhase={runningPhase} humanInboxCount={humanInboxItems.length} usageCost={projectUsage?.totals.estimated_cost_usd || 0} failedNotice={failedNotice} isMissionControlVisible={isMissionControlVisible} setMissionControlVisibility={setMissionControlVisibility} canvasView={canvasView} setCanvasMode={setCanvasMode} isCanvasMaximized={isCanvasMaximized} setIsCanvasMaximized={setIsCanvasMaximized} isLeftSidebarOpen={isLeftSidebarOpen} setIsLeftSidebarOpen={setIsLeftSidebarOpen} isRightSidebarOpen={isRightSidebarOpen} setIsRightSidebarOpen={setIsRightSidebarOpen} chatMessage={chatMessage} setChatMessage={setChatMessage} isChatSending={isChatSending} setIsChatSending={setIsChatSending} sendChat={sendChat} voiceEnabled={voiceEnabled} voiceStatus={voiceStatus} speakingAgentId={speakingAgentId} setVoiceConversationMode={setVoiceConversationMode} theme={theme} />
      <FactoryRightPanel t={t} project={project} agents={agents} isOpen={Boolean(project && !isCanvasMaximized && isRightSidebarOpen)} setIsOpen={setIsRightSidebarOpen} streamBuffers={streamBuffers} projectTraces={projectTraces} projectUsage={projectUsage} pendingToolApprovals={pendingToolApprovals} humanInboxItems={humanInboxItems} contextEconomy={contextEconomy} qualityStatuses={contextEconomy?.quality_eval_statuses || {}} usageRatio={usageRatio} topUsagePhase={projectUsage?.by_phase?.[0]} topUsageAgent={projectUsage?.by_agent?.[0]} replayPhase={replayPhase} setReplayPhase={setReplayPhase} replayPhases={replayPhases} replayEvents={replayEvents} approveContract={approveContract} retryProject={retryProject} decideToolApproval={decideToolApproval} setSelectedArtifact={setSelectedArtifact} setShowRawJson={setShowRawJson} />
      <ArtifactDetailPanel artifact={selectedArtifact} agents={agents} t={t} showRawJson={showRawJson} setShowRawJson={setShowRawJson} setSelectedArtifact={setSelectedArtifact} setPhaseToRollback={setPhaseToRollback} />
      <RollbackConfirmModal phase={phaseToRollback} project={project} rollbackPhase={rollbackPhase} setPhaseToRollback={setPhaseToRollback} setSelectedArtifact={setSelectedArtifact} />
    </section>
  );
}

function buildHumanInbox(
  project: Orchestrator["project"],
  failedPhaseError: string | null,
  pendingToolApprovals: Orchestrator["toolApprovals"],
  missingSecrets: NonNullable<Orchestrator["mcpSecrets"]>["secrets"][string][]
) {
  return [
    ...(project?.status === "waiting_approval" ? [{ id: "contract_approval", severity: "amber" as const, title: "Contrato pendiente", detail: "Revision del founder requerida", action: "Aprobar / rechazar" }] : []),
    ...(project?.status === "waiting_intervention" ? [{ id: "human_intervention", severity: "rose" as const, title: "Intervencion requerida", detail: failedPhaseError || "Fase bloqueada", action: "Continuar y reintentar" }] : []),
    ...pendingToolApprovals.slice(0, 3).map((approval) => ({ id: approval.id, severity: approval.risk === "high" ? "rose" as const : "amber" as const, title: approval.tool_name, detail: approval.reason, action: "Decidir tool" })),
    ...missingSecrets.slice(0, 3).map((secret) => ({ id: `secret_${secret.key}`, severity: "amber" as const, title: secret.key, detail: "Secreto MCP sin configurar", action: "Configurar MCP" })),
  ];
}
