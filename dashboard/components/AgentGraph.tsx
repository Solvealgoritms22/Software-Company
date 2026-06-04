"use client";

import { Background, Controls, Edge, MarkerType, Node, ReactFlow } from "@xyflow/react";
import { CheckCircle2, Circle, Clock, XCircle } from "lucide-react";
import type { AgentRegistry, ProjectState } from "../hooks/useOrchestrator";

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
  analysis: { x: 250, y: 0 },
  legal_contract: { x: 500, y: 0 },
  founder_approval: { x: 750, y: 0 },
  architecture: { x: 1000, y: 0 },
  senior_backend: { x: 1250, y: -130 },
  backend_development: { x: 1500, y: -130 },
  frontend_architecture: { x: 1250, y: 80 },
  frontend_development: { x: 1500, y: 80 },
  database: { x: 1500, y: 260 },
  qa: { x: 1750, y: 0 },
  security: { x: 2000, y: 0 },
  devops: { x: 2250, y: 0 },
  documentation: { x: 2500, y: 0 },
  done: { x: 2750, y: 0 }
};

const statusStyles = {
  pending: "border-line bg-surface text-text-strong hover:border-brand/30",
  running: "border-brand bg-brand/10 text-text-strong shadow-md ring-2 ring-brand ring-offset-2 ring-offset-surface animate-pulse",
  completed: "border-success bg-success/10 text-success shadow-sm",
  failed: "border-danger bg-danger/10 text-danger shadow-sm"
};

function StatusIcon({ status }: { status: string }) {
  if (status === "completed") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === "running") return <Clock className="h-3.5 w-3.5 text-brand" />;
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-danger" />;
  return <Circle className="h-3.5 w-3.5 text-text-muted" />;
}

export function AgentGraph({ project, registry, theme }: { project: ProjectState | null; registry: AgentRegistry | null; theme?: string }) {
  const agents = registry?.agents || {};
  const isDark = theme === "dark";
  const defaultStroke = isDark ? "#3a3a3f" : "#d1d5db";
  const runningStroke = isDark ? "#60a5fa" : "#0d9488";
  const completedStroke = isDark ? "#34d399" : "#10b981";

  const nodes: Node[] = phaseOrder
    .filter((phaseId) => project?.phases[phaseId])
    .map((phaseId) => {
      const phase = project!.phases[phaseId];
      const agentId = phase.agent;
      const agentDetails = agents[agentId] || {};
      
      const agentName = agentDetails.name || agentId.replaceAll("_", " ").replace(/\b\w/g, c => c.toUpperCase());
      const roleName = agentDetails.display_name || "Agent";
      const avatarUrl = agentDetails.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${agentName}`;

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
                <img 
                  src={avatarUrl} 
                  className="w-9 h-9 rounded-full bg-surface-muted border border-line object-cover" 
                  alt={agentName}
                />
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
    });

  const edges: Edge[] = Object.values(project?.phases || {}).flatMap((phase) =>
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
        <Controls />
      </ReactFlow>
    </div>
  );
}
