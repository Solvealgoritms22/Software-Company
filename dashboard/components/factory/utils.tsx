import { ReactNode } from "react";

export function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

export function formatCompactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 10000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(value) >= 10000 ? 1 : 0,
  }).format(value || 0);
}

export function formatUsd(value: number) {
  const normalized = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: normalized > 0 && normalized < 0.01 ? 4 : 2,
    maximumFractionDigits: normalized > 0 && normalized < 0.01 ? 6 : 2,
  }).format(normalized);
}

export function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return "0 ms";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)} s`;
}

export function traceStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("fail") || normalized.includes("error") || normalized.includes("denied")) return "bg-rose-500/10 text-rose-600";
  if (normalized.includes("approval") || normalized.includes("intervention") || normalized.includes("pending")) return "bg-amber-500/10 text-amber-600";
  if (normalized.includes("completed") || normalized.includes("success")) return "bg-emerald-500/10 text-emerald-600";
  return "bg-surface text-text-muted";
}

export function MetricCell({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-line bg-surface-muted p-2.5">
      <div className="text-[10px] font-bold uppercase text-text-muted">{label}</div>
      <div className="mt-1 truncate text-sm font-black text-text-strong">{value}</div>
      <div className="mt-0.5 truncate text-[10px] font-semibold text-text-muted">{detail}</div>
    </div>
  );
}

export function MissionMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "amber" }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface-muted px-1.5 py-1.5">
      <div className="truncate text-[8px] font-bold uppercase text-text-muted">{label}</div>
      <div className={`mt-0.5 h-4 truncate text-[11px] font-black leading-4 ${tone === "amber" ? "text-amber-600" : "text-text-strong"}`}>{value}</div>
    </div>
  );
}

export function SectionTitle({ icon, title }: { icon?: ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</div>;
}

export function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      {label}
      <input className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand shadow-sm placeholder:text-text-muted/60" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function Area({ label, value, onChange, minHeight, placeholder }: { label: string; value: string; onChange: (value: string) => void; minHeight?: string; placeholder?: string }) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      {label}
      <textarea className={`mt-1 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand shadow-sm placeholder:text-text-muted/60 ${minHeight || "min-h-[80px]"}`} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
