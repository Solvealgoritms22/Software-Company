import { ReactNode } from "react";


export function SidebarMetric({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="quiet-card flex items-center justify-between p-3">
      <div>
        <div className="text-xs text-[var(--text-muted)]">{label}</div>
        <div className="mt-1 text-lg font-semibold">{value}</div>
      </div>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-brand">{icon}</div>
    </div>
  );
}
