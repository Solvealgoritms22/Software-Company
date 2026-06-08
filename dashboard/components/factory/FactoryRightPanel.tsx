import { MaterialIcon } from "../MaterialIcon";
import { agentAvatarUrl } from "../agentSettingsData";
import type { ProjectArtifact, useOrchestrator } from "../../hooks/useOrchestrator";
import type { FactoryText } from "./translations";
import { asRecord, asString, formatCompactNumber, formatDuration, formatUsd, MetricCell, SectionTitle, traceStatusClass } from "./utils";

type Orchestrator = ReturnType<typeof useOrchestrator>;
type HumanInboxItem = { id: string; severity: "amber" | "rose"; title: string; detail: string; action: string };

type Props = {
  t: FactoryText;
  project: Orchestrator["project"];
  agents: NonNullable<Orchestrator["agentRegistry"]>["agents"];
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  streamBuffers: Record<string, string>;
  projectTraces: Orchestrator["projectTraces"];
  projectUsage: Orchestrator["projectUsage"];
  pendingToolApprovals: Orchestrator["toolApprovals"];
  humanInboxItems: HumanInboxItem[];
  contextEconomy: NonNullable<Orchestrator["projectUsage"]>["context_economy"] | undefined;
  qualityStatuses: Record<string, number>;
  usageRatio: number;
  topUsagePhase: NonNullable<Orchestrator["projectUsage"]>["by_phase"][number] | undefined;
  topUsageAgent: NonNullable<Orchestrator["projectUsage"]>["by_agent"][number] | undefined;
  replayPhase: string;
  setReplayPhase: (phase: string) => void;
  replayPhases: string[];
  replayEvents: Orchestrator["projectTraces"];
  approveContract: Orchestrator["approveContract"];
  retryProject: (id: string) => Promise<void>;
  decideToolApproval: Orchestrator["decideToolApproval"];
  setSelectedArtifact: (artifact: ProjectArtifact) => void;
  setShowRawJson: (value: boolean) => void;
};

export function FactoryRightPanel(props: Props) {
  const { project, isOpen } = props;
  if (!project || !isOpen) return null;
  const usageTotals = props.projectUsage?.totals;
  const usageBudget = props.projectUsage?.budget;

  return (
    <aside className="overflow-y-auto border-l border-line bg-surface p-4 scroll-mask-y">
      <div className="mb-4 flex items-center justify-between">
        <SectionTitle icon={<MaterialIcon name="description" className="w-4" />} title={props.t.artifactsControl} />
        <button type="button" onClick={() => props.setIsOpen(false)} className="rounded-md p-1.5 text-text-muted transition hover:bg-surface-muted hover:text-text-strong" title="Ocultar panel">
          <MaterialIcon name="chevron_right" className="w-4" />
        </button>
      </div>
      <HumanInbox items={props.humanInboxItems} />
      <InterventionCard project={project} retryProject={props.retryProject} />
      <ToolApprovals projectId={project.id} approvals={props.pendingToolApprovals} decideToolApproval={props.decideToolApproval} />
      <ContractApproval project={project} t={props.t} approveContract={props.approveContract} />
      <ArtifactsList project={project} agents={props.agents} t={props.t} setSelectedArtifact={props.setSelectedArtifact} setShowRawJson={props.setShowRawJson} />
      <StreamingBlock project={project} streamBuffers={props.streamBuffers} />
      <TraceReplay replayPhase={props.replayPhase} setReplayPhase={props.setReplayPhase} replayPhases={props.replayPhases} replayEvents={props.replayEvents} />
      <QualityGate contextEconomy={props.contextEconomy} qualityStatuses={props.qualityStatuses} />
      <ContextEconomy contextEconomy={props.contextEconomy} />
      <CostTokens usageTotals={usageTotals} usageBudget={usageBudget} usageRatio={props.usageRatio} topUsagePhase={props.topUsagePhase} topUsageAgent={props.topUsageAgent} agents={props.agents} />
      <Traces projectTraces={props.projectTraces} />
      <Logs project={project} agents={props.agents} t={props.t} />
    </aside>
  );
}

function HumanInbox({ items }: { items: HumanInboxItem[] }) {
  return (
    <div className="my-4 rounded-lg border border-line bg-surface-muted p-3.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-bold text-text-strong"><MaterialIcon name="inbox" className="w-4 text-brand" />Human Inbox</div>
        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${items.length ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>{items.length} pendientes</span>
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? <Empty text="Sin decisiones humanas pendientes." /> : items.slice(0, 6).map((item) => (
          <div key={item.id} className="rounded-lg border border-line bg-surface p-2.5">
            <div className="flex items-start gap-2">
              <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${item.severity === "rose" ? "bg-rose-500/10 text-rose-600" : "bg-amber-500/10 text-amber-600"}`}>
                <MaterialIcon name={item.id.startsWith("secret_") ? "key" : item.id.includes("approval") ? "verified_user" : "warning"} className="w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-bold text-text-strong">{item.title}</div>
                <div className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-text-muted">{item.detail}</div>
                <div className="mt-1 text-[10px] font-bold uppercase text-brand">{item.action}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InterventionCard({ project, retryProject }: { project: NonNullable<Orchestrator["project"]>; retryProject: (id: string) => Promise<void> }) {
  if (project.status !== "waiting_intervention") return null;
  const failedPhase = Object.values(project.phases).find((p) => p.status === "failed" || p.error);
  return (
    <div className="my-4 rounded-lg border border-amber-500 bg-amber-500/10 p-3.5 shadow-sm">
      <div className="flex items-center gap-1.5 text-sm font-bold text-amber-500">Intervencion humana requerida</div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-muted">El flujo se pauso por un fallo en un agente. Corrige el problema y reintenta.</p>
      {failedPhase ? <div className="mt-2.5 max-h-32 overflow-y-auto rounded border border-line bg-black/20 p-2 font-mono text-[10px] leading-normal text-rose-450">Fase: {failedPhase.id}<br />Error: {failedPhase.error}</div> : null}
      <button onClick={() => retryProject(project.id)} className="mt-3 rounded-lg bg-amber-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-amber-700 active:scale-95">Continuar y Reintentar</button>
    </div>
  );
}

function ToolApprovals({ projectId, approvals, decideToolApproval }: { projectId: string; approvals: Orchestrator["toolApprovals"]; decideToolApproval: Orchestrator["decideToolApproval"] }) {
  if (approvals.length === 0) return null;
  return (
    <div className="my-4 rounded-lg border border-amber-500 bg-amber-500/10 p-3.5 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-amber-600"><MaterialIcon name="verified_user" className="w-4" />Aprobaciones de herramientas</div>
      <p className="mt-1.5 text-xs leading-relaxed text-text-muted">Aprueba solo si reconoces la herramienta y el contexto.</p>
      <div className="mt-3 space-y-2">{approvals.slice(0, 4).map((approval) => (
        <div key={approval.id} className="rounded-lg border border-line bg-surface p-2.5">
          <div className="truncate text-xs font-bold text-text-strong">{approval.tool_name}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase text-amber-600">{approval.risk} - {approval.category}</div>
          <p className="mt-1.5 line-clamp-2 text-[11px] leading-relaxed text-text-muted">{approval.reason}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={() => decideToolApproval(projectId, approval.id, true, "Approved from dashboard")} className="rounded-md bg-emerald-700 px-2.5 py-1.5 text-[11px] font-bold text-white">Aprobar</button>
            <button type="button" onClick={() => decideToolApproval(projectId, approval.id, false, "Denied from dashboard")} className="rounded-md bg-rose-700 px-2.5 py-1.5 text-[11px] font-bold text-white">Denegar</button>
          </div>
        </div>
      ))}</div>
    </div>
  );
}

function ContractApproval({ project, t, approveContract }: { project: NonNullable<Orchestrator["project"]>; t: FactoryText; approveContract: Orchestrator["approveContract"] }) {
  if (project.status !== "waiting_approval") return null;
  return (
    <div className="my-4 rounded-lg border border-amber-300 bg-amber-50/50 p-3">
      <div className="text-sm font-semibold text-amber-900">{t.pendingContract}</div>
      <p className="mt-1 text-xs leading-relaxed text-amber-800">{t.contractPendingDesc}</p>
      <div className="mt-3 flex gap-2">
        <button onClick={() => approveContract(true, "Approved from dashboard")} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white">{t.approve}</button>
        <button onClick={() => approveContract(false, "Rejected from dashboard")} className="rounded-lg bg-red-700 px-3 py-2 text-xs font-semibold text-white">{t.reject}</button>
      </div>
    </div>
  );
}

function ArtifactsList({ project, agents, t, setSelectedArtifact, setShowRawJson }: { project: NonNullable<Orchestrator["project"]>; agents: NonNullable<Orchestrator["agentRegistry"]>["agents"]; t: FactoryText; setSelectedArtifact: (artifact: ProjectArtifact) => void; setShowRawJson: (value: boolean) => void }) {
  return (
    <div className="mt-4 space-y-3">{(project.artifacts || []).slice(0, 8).map((artifact) => {
      const agentDetails = agents[artifact.agent] || {};
      const agentLabel = agentDetails.name || artifact.agent;
      const avatarUrl = agentDetails.avatar_url || agentAvatarUrl(agentLabel);
      const summary = typeof artifact.content?.summary === "string" ? artifact.content.summary : null;
      return (
        <article key={artifact.id} onClick={() => { setSelectedArtifact(artifact); setShowRawJson(false); }} className="quiet-card cursor-pointer p-4 transition-all duration-300 hover:border-[var(--line-strong)] hover:shadow-md group">
          <div className="flex items-center gap-3">
            <img src={avatarUrl} className="avatar-image h-8 w-8 rounded-full border border-line object-fill" alt="" />
            <div><div className="text-sm font-bold text-text-strong transition group-hover:text-brand">{artifact.title}</div><div className="text-[10px] font-bold text-[var(--text-muted)]">{agentLabel} - {artifact.type}</div></div>
          </div>
          {summary ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-text-muted">{summary}</p> : null}
          <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-brand transition-transform group-hover:translate-x-1">{t.viewEnriched} -&gt;</div>
        </article>
      );
    })}</div>
  );
}

function StreamingBlock({ project, streamBuffers }: { project: NonNullable<Orchestrator["project"]>; streamBuffers: Record<string, string> }) {
  const current = project.current_phase;
  if (project.status !== "running" || !current || !streamBuffers[current]) return null;
  return (
    <div className="mt-6 rounded-lg border border-brand/50 bg-brand/5 p-4">
      <h4 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase text-brand"><span className="h-2 w-2 rounded-full bg-brand animate-ping" />Streaming {current.replaceAll("_", " ")}...</h4>
      <div className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-text-strong">{streamBuffers[current]}</div>
    </div>
  );
}

function TraceReplay({ replayPhase, setReplayPhase, replayPhases, replayEvents }: { replayPhase: string; setReplayPhase: (phase: string) => void; replayPhases: string[]; replayEvents: Orchestrator["projectTraces"] }) {
  return (
    <MetricSection icon="replay" title="Trace Replay">
      <div className="flex items-center gap-1 overflow-x-auto rounded-lg border border-line bg-surface-muted p-1">
        <ReplayButton active={replayPhase === "all"} label="Todo" onClick={() => setReplayPhase("all")} />
        {replayPhases.slice(0, 8).map((phase) => <ReplayButton key={phase} active={replayPhase === phase} label={phase.replaceAll("_", " ")} onClick={() => setReplayPhase(phase)} />)}
      </div>
      <div className="mt-3 space-y-2">{replayEvents.length === 0 ? <Empty text="Sin eventos para reproducir todavia." /> : replayEvents.slice(-12).map((trace) => <TraceReplayEvent key={trace.id} trace={trace} />)}</div>
    </MetricSection>
  );
}

function TraceReplayEvent({ trace }: { trace: Orchestrator["projectTraces"][number] }) {
  const metadata = asRecord(trace.metadata) || {};
  const status = asString(metadata.status) || trace.event_type.replaceAll("_", " ");
  const toolName = asString(metadata.tool_name);
  const duration = typeof metadata.duration_ms === "number" ? metadata.duration_ms : null;
  const title = trace.event_type === "llm_call" ? `${asString(metadata.provider) || trace.provider || "llm"} - ${asString(metadata.model) || trace.model || "model"}` : toolName || trace.event_type.replaceAll("_", " ");
  const preview = trace.event_type === "tool_call" ? asString(metadata.result_preview) : asString(metadata.error) || asString(metadata.message) || asString(metadata.summary);
  return (
    <div className="rounded-lg border border-line bg-surface-muted p-2.5 text-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><div className="truncate font-bold text-text-strong">{title}</div><div className="mt-0.5 truncate text-[10px] font-semibold text-text-muted">{trace.phase.replaceAll("_", " ")} - {trace.agent}</div></div>
        <div className="flex shrink-0 items-center gap-1">{duration !== null ? <span className="rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">{formatDuration(duration)}</span> : null}<span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${traceStatusClass(status)}`}>{status}</span></div>
      </div>
      {preview ? <div className="mt-1.5 line-clamp-2 font-mono text-[10px] leading-relaxed text-text-muted">{preview}</div> : null}
    </div>
  );
}

function QualityGate({ contextEconomy, qualityStatuses }: { contextEconomy: Props["contextEconomy"]; qualityStatuses: Record<string, number> }) {
  return (
    <MetricSection icon="verified_user" title="Quality Gate">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <MetricCell label="Calidad" value={`${Math.round((contextEconomy?.quality_eval_score || 0) * 100)}%`} detail={`${formatCompactNumber(contextEconomy?.quality_eval_count || 0)} fases evaluadas`} />
        <MetricCell label="Warnings" value={formatCompactNumber((qualityStatuses.warning || 0) + (qualityStatuses.failed || 0))} detail="quality gate" />
        <MetricCell label="Side effects" value={formatCompactNumber(contextEconomy?.side_effect_warnings || 0)} detail="tools sensibles" />
        <MetricCell label="Contratos" value={`${formatCompactNumber(contextEconomy?.contract_valid_count || 0)}/${formatCompactNumber(contextEconomy?.contract_eval_count || 0)}`} detail={`${formatCompactNumber(contextEconomy?.contract_autofix_count || 0)} autocorrecciones`} />
        <MetricCell label="Replays evitados" value={formatCompactNumber(contextEconomy?.idempotency_replays_prevented || 0)} detail={`${formatCompactNumber(contextEconomy?.idempotency_records || 0)} acciones unicas`} />
        <MetricCell label="Passed" value={formatCompactNumber(qualityStatuses.passed || 0)} detail="fases limpias" />
      </div>
    </MetricSection>
  );
}

function ContextEconomy({ contextEconomy }: { contextEconomy: Props["contextEconomy"] }) {
  return (
    <MetricSection icon="hub" title="Context Economy">
      <div className="grid grid-cols-2 gap-2">
        <MetricCell label="Contexto" value={formatCompactNumber(contextEconomy?.context_tokens_sent || 0)} detail="tokens enviados" />
        <MetricCell label="Evitado" value={formatCompactNumber(contextEconomy?.tokens_avoided_estimate || 0)} detail="tokens no enviados" />
        <MetricCell label="Cache" value={formatCompactNumber(contextEconomy?.semantic_cache_items || 0)} detail={`${formatCompactNumber(contextEconomy?.semantic_cache_events || 0)} eventos`} />
        <MetricCell label="Citas" value={`${formatCompactNumber(contextEconomy?.citations_used || 0)}/${formatCompactNumber(contextEconomy?.citations_available || 0)}`} detail="usadas / disponibles" />
      </div>
    </MetricSection>
  );
}

function CostTokens({ usageTotals, usageBudget, usageRatio, topUsagePhase, topUsageAgent, agents }: { usageTotals: NonNullable<Orchestrator["projectUsage"]>["totals"] | undefined; usageBudget: NonNullable<Orchestrator["projectUsage"]>["budget"] | undefined; usageRatio: number; topUsagePhase: Props["topUsagePhase"]; topUsageAgent: Props["topUsageAgent"]; agents: NonNullable<Orchestrator["agentRegistry"]>["agents"] }) {
  return (
    <MetricSection icon="bolt" title="Costo / Tokens">
      <div className="grid grid-cols-2 gap-2">
        <MetricCell label="Tokens" value={formatCompactNumber(usageTotals?.total_tokens || 0)} detail={`${formatCompactNumber(usageTotals?.prompt_tokens || 0)} in / ${formatCompactNumber(usageTotals?.completion_tokens || 0)} out`} />
        <MetricCell label="Costo" value={formatUsd(usageTotals?.estimated_cost_usd || 0)} detail={`${formatCompactNumber(usageTotals?.events || 0)} eventos`} />
        <MetricCell label="Cache" value={formatCompactNumber(usageTotals?.cached_tokens || 0)} detail="tokens reutilizados" />
        <MetricCell label="Mayor uso" value={topUsagePhase?.phase?.replaceAll("_", " ") || "sin datos"} detail={topUsagePhase ? formatUsd(topUsagePhase.estimated_cost_usd) : "fase"} />
      </div>
      {usageBudget?.max_project_cost_usd ? <div className="mt-3 rounded-lg border border-line bg-surface-muted p-2.5"><div className="flex justify-between text-[10px] font-bold uppercase text-text-muted"><span>Presupuesto IA</span><span>{Math.round(usageRatio * 100)}%</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface"><div className={`h-full rounded-full ${usageBudget.is_exceeded ? "bg-rose-600" : "bg-brand"}`} style={{ width: `${usageRatio > 0 ? Math.max(4, usageRatio * 100) : 0}%` }} /></div></div> : null}
      {topUsageAgent ? <div className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-2.5 text-xs"><span className="min-w-0 truncate font-semibold text-text-strong">{agents[topUsageAgent.agent]?.name || topUsageAgent.agent}</span><span className="shrink-0 font-mono text-[10px] text-text-muted">{formatCompactNumber(topUsageAgent.total_tokens)} tok</span></div> : null}
    </MetricSection>
  );
}

function Traces({ projectTraces }: { projectTraces: Orchestrator["projectTraces"] }) {
  return (
    <MetricSection icon="bolt" title="Trazas">
      <div className="space-y-2">{projectTraces.length === 0 ? <Empty text="Sin trazas registradas para este proyecto." /> : projectTraces.slice(0, 8).map((trace) => {
        const message = typeof trace.metadata?.message === "string" ? trace.metadata.message : typeof trace.metadata?.summary === "string" ? trace.metadata.summary : trace.event_type.replaceAll("_", " ");
        const tokenTotal = trace.prompt_tokens + trace.completion_tokens;
        return <div key={trace.id} className="rounded-lg border border-line bg-[var(--surface-muted)] p-2.5 text-xs shadow-sm"><div className="flex items-center justify-between gap-2"><div className="min-w-0 font-semibold text-text-strong"><span className="text-brand">{trace.event_type}</span><span className="text-text-muted"> - {trace.agent} - {trace.phase}</span></div>{tokenTotal > 0 ? <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">{tokenTotal} tok</span> : null}</div><div className="mt-1 line-clamp-2 font-mono text-[10px] leading-relaxed text-text-muted">{message}</div></div>;
      })}</div>
    </MetricSection>
  );
}

function Logs({ project, agents, t }: { project: NonNullable<Orchestrator["project"]>; agents: NonNullable<Orchestrator["agentRegistry"]>["agents"]; t: FactoryText }) {
  return (
    <MetricSection icon="verified_user" title={t.activity}>
      <div className="space-y-2">{(project.logs || []).slice(0, 12).map((log) => <div key={log.id} className="rounded-lg border border-line bg-[var(--surface-muted)] p-2.5 text-xs shadow-sm"><div className="flex items-center gap-1.5 font-semibold text-text-strong"><MaterialIcon name="chat" className="w-3.5 text-brand" />{agents[log.agent]?.name || log.agent}</div><div className="mt-0.5 max-h-32 overflow-y-auto whitespace-pre-wrap pr-1 font-mono text-[var(--text-muted)]">{log.message}</div></div>)}</div>
    </MetricSection>
  );
}

function MetricSection({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return <div className="mt-6"><SectionTitle icon={<MaterialIcon name={icon} className="w-4" />} title={title} /><div className="mt-3 quiet-card p-3.5">{children}</div></div>;
}

function ReplayButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-bold transition ${active ? "bg-surface text-text-strong shadow-sm" : "text-text-muted hover:text-text-strong"}`}>{label}</button>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-line bg-surface-muted p-3 text-xs font-semibold text-text-muted">{text}</div>;
}
