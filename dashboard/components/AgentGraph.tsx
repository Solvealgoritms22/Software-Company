"use client";

import { memo, useMemo } from "react";
import { Background, Controls, Edge, MarkerType, Node, ReactFlow } from "@xyflow/react";
import type { AgentRegistry, ProjectState } from "../hooks/useOrchestrator";
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
  "done"
];

const positions: Record<string, { x: number; y: number }> = {
  ceo: { x: 0, y: 0 },
  analysis: { x: 0, y: 150 },
  legal_contract: { x: 0, y: 300 },
  founder_approval: { x: 0, y: 450 },
  architecture: { x: 0, y: 600 },
  senior_backend: { x: -180, y: 750 },
  backend_development: { x: -180, y: 900 },
  frontend_architecture: { x: 180, y: 750 },
  frontend_development: { x: 180, y: 900 },
  database: { x: 180, y: 1050 },
  qa: { x: 0, y: 1200 },
  security: { x: 0, y: 1350 },
  devops: { x: 0, y: 1500 },
  documentation: { x: 0, y: 1650 },
  done: { x: 0, y: 1800 }
};

const statusStyles = {
  pending: "border-line bg-surface text-text-strong hover:border-brand/30",
  running: "border-brand bg-brand/10 text-text-strong shadow-md ring-2 ring-brand ring-offset-2 ring-offset-surface animate-pulse",
  completed: "border-success bg-success/10 text-success shadow-sm",
  failed: "border-danger bg-danger/10 text-danger shadow-sm"
};

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <span className="material-symbols-outlined w-3.5 h-3.5 text-success">check_circle</span>;
  }
  if (status === "running") {
    return <span className="material-symbols-outlined w-3.5 h-3.5 text-brand animate-spin-custom">progress_activity</span>;
  }
  if (status === "failed") {
    return <span className="material-symbols-outlined w-3.5 h-3.5 text-danger">cancel</span>;
  }
  return <span className="material-symbols-outlined w-3.5 h-3.5 text-text-muted">circle</span>;
}

export const AgentGraph = memo(function AgentGraph({
  project,
  registry,
  theme,
  speakingAgentId,
}: {
  project: ProjectState | null;
  registry: AgentRegistry | null;
  theme?: string;
  speakingAgentId?: string | null;
}) {
  const agents = registry?.agents || {};
  const isDark = theme === "dark";
  const defaultStroke = isDark ? "#3a3a3f" : "#d1d5db";
  const runningStroke = isDark ? "#60a5fa" : "#0d9488";
  const completedStroke = isDark ? "#34d399" : "#10b981";

  const nodes: Node[] = useMemo(
    () => phaseOrder
      .filter((phaseId) => project?.phases[phaseId])
      .map((phaseId) => {
        const phase = project!.phases[phaseId];
        const agentId = phase.agent;
        const agentDetails = agents[agentId] || {};

        const agentName = agentDetails.name || agentId.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
        const roleName = agentDetails.display_name || "Agent";
        const avatarUrl = agentDetails.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentName}`;
        const speaking = speakingAgentId === agentId;

        return {
          id: phaseId,
          position: positions[phaseId],
          data: {
            label: (
              <div className={`min-w-[210px] rounded-xl border p-3.5 transition-all duration-300 ${statusStyles[phase.status]}`}>
                <div className="flex items-center justify-between border-b border-line pb-2 mb-2">
                  <span className="text-[10px] font-bold tracking-wider uppercase text-text-muted">
                    {phaseId.replaceAll("_", " ")}
                  </span>
                  <StatusIcon status={phase.status} />
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <img
                      src={avatarUrl}
                      className={`w-9 h-9 rounded-full bg-surface-muted border object-cover ${speaking ? "border-brand shadow-[0_0_0_3px_rgba(37,99,235,0.16)]" : "border-line"}`}
                      alt={agentName}
                    />
                    {speaking ? (
                      <span className="absolute -right-3 -top-3">
                        <SpeakingIndicator active size="sm" />
                      </span>
                    ) : null}
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-semibold text-text-strong leading-tight">{agentName}</div>
                    <div className="text-[10px] text-text-muted leading-normal font-medium">{roleName}</div>
                  </div>
                </div>
              </div>
            )
          },
          type: "default"
        };
      }),
    [agents, project, speakingAgentId]
  );

  const edges: Edge[] = useMemo(
    () => Object.values(project?.phases || {}).flatMap((phase) =>
      phase.depends_on.map((dep) => ({
        id: `${dep}-${phase.id}`,
        source: dep,
        target: phase.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: {
          strokeWidth: 2,
          stroke: phase.status === "completed" ? completedStroke : phase.status === "running" ? runningStroke : defaultStroke
        }
      }))
    ),
    [completedStroke, defaultStroke, project?.phases, runningStroke]
  );

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-text-muted font-medium">
        Crea un proyecto y tu empresa realizara el trabajo.
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[640px]">
      <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false}>
        <Background color={isDark ? "#2b2b2e" : "#ccc"} />
        <Controls orientation="horizontal" style={{ bottom: "40px", left: "16px" }} />
      </ReactFlow>
    </div>
  );
});
