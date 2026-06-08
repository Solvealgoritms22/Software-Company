import { motion, AnimatePresence } from "framer-motion";

import { MarkdownRenderer } from "../MarkdownRenderer";
import { MaterialIcon } from "../MaterialIcon";
import { agentAvatarUrl } from "../agentSettingsData";
import type { ProjectArtifact, useOrchestrator } from "../../hooks/useOrchestrator";
import type { FactoryText } from "./translations";
import { asRecord, asString, asStringArray } from "./utils";

type Orchestrator = ReturnType<typeof useOrchestrator>;

type ArtifactProps = {
  artifact: ProjectArtifact | null;
  agents: NonNullable<Orchestrator["agentRegistry"]>["agents"];
  t: FactoryText;
  showRawJson: boolean;
  setShowRawJson: (value: boolean) => void;
  setSelectedArtifact: (artifact: ProjectArtifact | null) => void;
  setPhaseToRollback: (phase: string | null) => void;
};

export function ArtifactDetailPanel({
  artifact,
  agents,
  t,
  showRawJson,
  setShowRawJson,
  setSelectedArtifact,
  setPhaseToRollback,
}: ArtifactProps) {
  if (!artifact) return null;
  const agentDetails = agents[artifact.agent] || {};
  const agentLabel = agentDetails.name || artifact.agent;
  const avatarUrl = agentDetails.avatar_url || agentAvatarUrl(agentLabel);
  const content = artifact.content || {};
  const summary = asString(content.summary);
  const deliverables = asRecord(content.deliverables);
  const risks = asStringArray(content.risks);
  const nextRequiredInputs = asStringArray(content.next_required_inputs);

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-full flex-col border-l border-line bg-surface shadow-2xl fade-in sm:w-[min(620px,calc(100vw-2rem))]">
      <div className="flex shrink-0 items-center justify-between border-b border-line bg-surface px-6 py-4">
        <div className="flex items-center gap-3">
          <img src={avatarUrl} className="avatar-image h-10 w-10 rounded-full border border-line object-fill" alt="" />
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-text-strong"><MaterialIcon name="description" className="w-5 text-brand" />{artifact.title}</h3>
            <div className="text-xs font-semibold text-[var(--text-muted)]">{agentLabel} ({agentDetails.display_name || "Agent"})</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPhaseToRollback(artifact.type)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs font-bold text-danger transition hover:bg-danger/10" title="Revertir y reintentar esta fase">Rollback</button>
          <button onClick={() => setSelectedArtifact(null)} className="rounded-lg border border-line bg-surface p-1.5 text-text-muted transition hover:text-text-strong hover:shadow-sm active:scale-95" aria-label="Cerrar detalle de artefacto">
            <MaterialIcon name="close" className="w-4" />
          </button>
        </div>
      </div>

      <div className="flex shrink-0 border-b border-line bg-surface-muted/50 px-6">
        <TabButton active={!showRawJson} label={t.formattedDeliverable} onClick={() => setShowRawJson(false)} />
        <TabButton active={showRawJson} label={t.rawJson} onClick={() => setShowRawJson(true)} />
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-6 scroll-mask-y">
        {showRawJson ? (
          <pre className="h-full max-h-[70vh] overflow-auto rounded-lg bg-gray-950 p-4 font-mono text-xs text-gray-200 shadow-inner">{JSON.stringify(content, null, 2)}</pre>
        ) : (
          <div className="space-y-6">
            {summary ? <Callout title={t.phaseSummary} tone="brand"><p className="text-sm font-normal leading-relaxed text-text-strong">{summary}</p></Callout> : null}
            {deliverables ? <Deliverables deliverables={deliverables} /> : null}
            {risks.length > 0 ? <ListCallout title={t.risksAndBlocks} tone="danger" items={risks} /> : null}
            {nextRequiredInputs.length > 0 ? <ListCallout title={t.inputsAndNext} tone="info" items={nextRequiredInputs} /> : null}
          </div>
        )}
      </div>
    </div>
  );
}

export function RollbackConfirmModal({
  phase,
  project,
  rollbackPhase,
  setPhaseToRollback,
  setSelectedArtifact,
}: {
  phase: string | null;
  project: Orchestrator["project"];
  rollbackPhase: (projectId: string, phaseId: string) => Promise<void>;
  setPhaseToRollback: (phase: string | null) => void;
  setSelectedArtifact: (artifact: ProjectArtifact | null) => void;
}) {
  return (
    <AnimatePresence>
      {phase ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className="relative w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-2xl">
            <h3 className="mb-2 text-lg font-bold text-text-strong">Confirmar Rollback</h3>
            <p className="mb-6 text-sm text-text-muted">Seguro que deseas revertir la fase <strong>{phase.replaceAll("_", " ")}</strong>? Se borraran sus artefactos, se reiniciaran las dependencias y el proyecto se reanudara desde este punto.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setPhaseToRollback(null)} className="rounded-lg px-4 py-2 text-sm font-medium text-text-muted transition hover:bg-surface-muted hover:text-text-strong">Cancelar</button>
              <button onClick={() => { if (project) rollbackPhase(project.id, phase); setPhaseToRollback(null); setSelectedArtifact(null); }} className="rounded-lg bg-danger px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-danger/90">Confirmar y Revertir</button>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

function Deliverables({ deliverables }: { deliverables: Record<string, unknown> }) {
  return (
    <div className="space-y-6">
      <h4 className="border-b border-line pb-1 text-xs font-bold uppercase tracking-wider text-text-muted">Entregables Generados</h4>
      {Object.entries(deliverables).map(([key, val]) => (
        <div key={key} className="space-y-3 rounded-lg border border-line bg-surface-muted/10 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h5 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-text-strong"><MaterialIcon name="data_object" className="w-4 text-brand" />{key.replaceAll("_", " ")}</h5>
            {typeof val === "string" ? <PrintButton keyName={key} /> : null}
          </div>
          <div id={`deliverable-${key}`} className="max-h-[450px] overflow-y-auto rounded-lg border border-line bg-surface p-4 shadow-inner">
            {typeof val === "string" ? <MarkdownRenderer text={normalizeMarkdown(val)} /> : <pre className="overflow-auto font-mono text-xs text-text-muted">{JSON.stringify(val, null, 2)}</pre>}
          </div>
        </div>
      ))}
    </div>
  );
}

function PrintButton({ keyName }: { keyName: string }) {
  return (
    <button onClick={() => printDeliverable(keyName)} className="flex items-center gap-1 rounded-md bg-brand/10 px-2 py-1 text-xs font-bold text-brand hover:underline">
      <MaterialIcon name="download" className="w-4 text-brand" />
      Descargar PDF
    </button>
  );
}

function printDeliverable(keyName: string) {
  const printWindow = window.open("", "", "width=800,height=600");
  if (!printWindow) return;
  printWindow.document.write(`<html><head><title>${keyName.replaceAll("_", " ")}</title><style>body{font-family:sans-serif;padding:20px;line-height:1.6;color:#333}pre{background:#f4f4f4;padding:10px;overflow-x:auto}code{background:#f4f4f4;padding:2px 4px}</style></head><body>${document.getElementById(`deliverable-${keyName}`)?.innerHTML || ""}</body></html>`);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 250);
}

function normalizeMarkdown(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("```markdown")) return trimmed.substring(11).replace(/```$/, "").trim();
  if (trimmed.startsWith("```\n")) return trimmed.substring(4).replace(/```$/, "").trim();
  return text;
}

function TabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button className={`border-b-2 px-4 py-2.5 text-xs font-bold transition ${active ? "border-brand text-brand" : "border-transparent text-text-muted hover:text-text-strong"}`} onClick={onClick}>{label}</button>;
}

function Callout({ title, tone, children }: { title: string; tone: "brand" | "danger" | "info"; children: React.ReactNode }) {
  const classes = tone === "brand" ? "bg-brand/5 border-brand/20 text-brand" : tone === "danger" ? "bg-danger/5 border-danger/20 text-danger" : "bg-info/5 border-info/20 text-info";
  return <div className={`rounded-lg border p-4 shadow-sm ${classes}`}><h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider">{title}</h4>{children}</div>;
}

function ListCallout({ title, tone, items }: { title: string; tone: "danger" | "info"; items: string[] }) {
  return (
    <Callout title={title} tone={tone}>
      <ul className="list-inside list-disc space-y-1.5 text-sm font-semibold text-text-strong">
        {items.map((item, idx) => <li key={idx} className="leading-relaxed">{item}</li>)}
      </ul>
    </Callout>
  );
}
