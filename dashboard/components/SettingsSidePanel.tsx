import { useState, useEffect, useRef } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { MenuSelect } from "./MenuSelect";
import { agentAvatarUrl } from "./agentSettingsData";
import { apiBase, apiFetch } from "../lib/orchestratorApi";

type SettingsCopy = Record<string, string>;

type Props = {
  t: SettingsCopy;
  founder: string;
  collaborators: string[];
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  language: "en" | "es";
  setLanguage: (language: "en" | "es") => void;
  toolPolicyMode: "approval_required" | "full_access";
  setToolPolicyMode: (mode: "approval_required" | "full_access") => void;
  voiceConversationsEnabled: boolean;
  setVoiceConversationsEnabled: (enabled: boolean) => void;
};

export function SettingsSidePanel({
  t,
  founder,
  collaborators,
  theme,
  setTheme,
  language,
  setLanguage,
  toolPolicyMode,
  setToolPolicyMode,
  voiceConversationsEnabled,
  setVoiceConversationsEnabled,
}: Props) {
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "available" | "up-to-date" | "downloading" | "error" | "installing">("idle");
  const [remoteVersion, setRemoteVersion] = useState<string>("");
  const [updateUrl, setUpdateUrl] = useState<string>("");
  const [updateNotes, setUpdateNotes] = useState<string>("");
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const statusPollInterval = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (statusPollInterval.current) {
        window.clearInterval(statusPollInterval.current);
      }
    };
  }, []);

  const checkUpdates = async () => {
    setUpdateStatus("checking");
    setErrorMessage("");
    try {
      const res = await apiFetch(`${apiBase}/app/updates/check`);
      if (!res.ok) throw new Error("Failed to check updates");
      const data = await res.json();
      if (data.success && data.update) {
        setRemoteVersion(data.update.version);
        setUpdateUrl(data.update.url);
        setUpdateNotes(data.update.notes || "");
        setUpdateStatus("available");
      } else {
        setUpdateStatus("up-to-date");
      }
    } catch (err: any) {
      setUpdateStatus("error");
      setErrorMessage(err.message || "Error checking updates");
    }
  };

  const startDownload = async () => {
    setUpdateStatus("downloading");
    setDownloadProgress(0);
    try {
      const res = await apiFetch(`${apiBase}/app/updates/download-and-install`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: updateUrl })
      });
      if (!res.ok) throw new Error("Failed to start update");
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed to start update");
      
      // Start polling status
      if (statusPollInterval.current) window.clearInterval(statusPollInterval.current);
      statusPollInterval.current = window.setInterval(async () => {
        try {
          const statusRes = await apiFetch(`${apiBase}/app/updates/status`);
          if (!statusRes.ok) return;
          const statusData = await statusRes.json();
          if (statusData.success && statusData.update) {
            const upd = statusData.update;
            if (upd.state === "error") {
              setUpdateStatus("error");
              setErrorMessage(upd.message || "Error during download");
              if (statusPollInterval.current) window.clearInterval(statusPollInterval.current);
            } else if (upd.state === "launching") {
              setUpdateStatus("installing");
              setDownloadProgress(100);
              if (statusPollInterval.current) window.clearInterval(statusPollInterval.current);
              // Wait 1.5 seconds and quit app using Tauri if available
              setTimeout(() => {
                if (typeof window !== "undefined" && window.__TAURI__) {
                  window.__TAURI__.window.getCurrentWindow().close();
                }
              }, 1500);
            } else {
              setDownloadProgress(upd.progress || 0);
            }
          }
        } catch (pollErr) {
          // Ignore poll errors temporarily
        }
      }, 800) as unknown as number;
    } catch (err: any) {
      setUpdateStatus("error");
      setErrorMessage(err.message || "Failed to download update");
    }
  };

  return (
    <div className="space-y-6">
      <div className="quiet-card p-5 space-y-4 shadow-sm">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <MaterialIcon name="public" className="w-4 text-brand" />
          System & Theme Settings
        </h3>
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-text-muted">{t.theme}</span>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <ThemeButton active={theme === "light"} icon="light_mode" label={t.themeLight} onClick={() => setTheme("light")} />
            <ThemeButton active={theme === "dark"} icon="dark_mode" label={t.themeDark} onClick={() => setTheme("dark")} />
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-line">
          <span className="block text-xs font-semibold text-text-muted">{t.language}</span>
          <MenuSelect
            value={language}
            onChange={(val) => setLanguage(val as "en" | "es")}
            options={[
              { value: "en", label: t.langEn, iconUrl: "https://flagcdn.com/w20/us.png" },
              { value: "es", label: t.langEs, iconUrl: "https://flagcdn.com/w20/es.png" },
            ]}
          />
        </div>
      </div>
      {(founder || collaborators.length > 0) ? (
        <ProfilePreviews t={t} founder={founder} collaborators={collaborators} />
      ) : null}
      <div className="quiet-card p-5 space-y-4 shadow-sm border border-line">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <MaterialIcon name="verified_user" className="w-4 text-brand" />
          {t.policiesTitle}
        </h3>
        <div className="space-y-2">
          <span className="block text-xs font-semibold text-text-strong">{t.toolPolicy}</span>
          <span className="block text-[10px] text-text-muted">{t.toolPolicyDesc}</span>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <PolicyButton active={toolPolicyMode === "approval_required"} label={t.approvalRequired} onClick={() => setToolPolicyMode("approval_required")} />
            <PolicyButton active={toolPolicyMode === "full_access"} label={t.fullAccess} onClick={() => setToolPolicyMode("full_access")} />
          </div>
        </div>
        <div className="space-y-2 pt-3 border-t border-line">
          <div className="flex items-center justify-between">
            <div>
              <span className="block text-xs font-semibold text-text-strong">{t.agentVoice}</span>
              <span className="block text-[10px] text-text-muted mt-0.5">{t.agentVoiceDesc}</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" checked={voiceConversationsEnabled} onChange={(e) => setVoiceConversationsEnabled(e.target.checked)} className="sr-only peer" />
              <div className="w-9 h-5 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:bg-line peer-checked:bg-brand" />
            </label>
          </div>
        </div>
      </div>

      {/* Actualizaciones Card */}
      <div className="quiet-card p-5 space-y-4 shadow-sm border border-line">
        <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <MaterialIcon name="update" className="w-4 text-brand" />
          {t.updatesTitle}
        </h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-text-muted">{t.currentVersion}</span>
            <span className="font-mono bg-surface-muted px-2 py-0.5 rounded border border-line text-text-strong font-bold">1.0.0</span>
          </div>

          {updateStatus === "idle" && (
            <button
              type="button"
              onClick={checkUpdates}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-line bg-surface hover:bg-surface-muted text-text-strong text-xs font-bold transition shadow-sm active:scale-95"
            >
              <MaterialIcon name="search" className="w-4" />
              {t.checkUpdates}
            </button>
          )}

          {updateStatus === "checking" && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-text-muted font-medium">
              <span className="w-3.5 h-3.5 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
              {t.checkingUpdates}
            </div>
          )}

          {updateStatus === "up-to-date" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-brand font-semibold bg-brand/5 border border-brand/10 p-2 rounded-lg justify-center animate-fade-in">
                <MaterialIcon name="check_circle" className="w-4 text-brand" />
                {t.noUpdates}
              </div>
              <button
                type="button"
                onClick={checkUpdates}
                className="w-full flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg border border-line bg-surface hover:bg-surface-muted text-text-muted text-xs font-medium transition"
              >
                {t.checkUpdates}
              </button>
            </div>
          )}

          {updateStatus === "available" && (
            <div className="space-y-3 border border-brand/20 bg-brand/5 p-3.5 rounded-xl animate-fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-brand">{t.updateAvailable}</span>
                <span className="font-mono font-bold bg-brand/10 text-brand px-2 py-0.5 rounded">v{remoteVersion}</span>
              </div>
              {updateNotes && (
                <div className="text-[11px] text-text-muted bg-surface/50 border border-line p-2 rounded-lg max-h-24 overflow-y-auto leading-relaxed">
                  {updateNotes}
                </div>
              )}
              <button
                type="button"
                onClick={startDownload}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-brand text-surface hover:bg-brand-strong text-xs font-bold rounded-lg transition shadow-sm active:scale-95"
              >
                <MaterialIcon name="download" className="w-4" />
                {t.downloadInstall}
              </button>
            </div>
          )}

          {(updateStatus === "downloading" || updateStatus === "installing") && (
            <div className="space-y-2.5 p-3 border border-line bg-surface-muted/50 rounded-xl">
              <div className="flex justify-between text-xs font-semibold">
                <span className="text-text-strong">
                  {updateStatus === "downloading" ? t.downloading : t.installing}
                </span>
                <span className="text-brand font-bold font-mono">{downloadProgress}%</span>
              </div>
              <div className="w-full bg-line h-1.5 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="bg-brand h-full transition-all duration-300 rounded-full bg-gradient-to-r from-brand to-brand-strong"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            </div>
          )}

          {updateStatus === "error" && (
            <div className="space-y-3">
              <div className="text-xs text-danger bg-danger/5 border border-danger/10 p-2.5 rounded-lg font-medium leading-relaxed">
                <div className="flex items-center gap-1.5 font-bold mb-1">
                  <MaterialIcon name="error" className="w-4" />
                  Error
                </div>
                {errorMessage}
              </div>
              <button
                type="button"
                onClick={checkUpdates}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg border border-line bg-surface hover:bg-surface-muted text-text-strong text-xs font-bold transition"
              >
                <MaterialIcon name="refresh" className="w-4" />
                Reintentar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ThemeButton({ active, icon, label, onClick }: { active: boolean; icon: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition shadow-sm ${active ? "border-brand bg-brand/5 text-brand" : "border-line bg-surface hover:bg-surface-muted text-text-muted"}`}>
      <MaterialIcon name={icon} className="w-4" />
      {label}
    </button>
  );
}

function PolicyButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition shadow-sm ${active ? "border-brand bg-brand/5 text-brand" : "border-line bg-surface hover:bg-surface-muted text-text-muted"}`}>
      {label}
    </button>
  );
}

function ProfilePreviews({ t, founder, collaborators }: { t: SettingsCopy; founder: string; collaborators: string[] }) {
  return (
    <div className="space-y-4">
      {founder ? (
        <div className="quiet-card p-4 shadow-sm border border-brand/20 relative overflow-hidden bg-gradient-to-br from-brand/5 to-transparent">
          <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-3">{t.founderCardTitle}</span>
          <div className="flex items-center gap-3">
            <img src={`https://github.com/${founder.trim()}.png`} className="avatar-image w-12 h-12 rounded-full border border-line object-fill shadow-sm" alt="" onError={(e) => { (e.target as HTMLImageElement).src = agentAvatarUrl(founder); }} />
            <div className="min-w-0">
              <div className="font-bold text-sm text-text-strong truncate">{founder}</div>
              <a href={`https://github.com/${founder.trim()}`} target="_blank" rel="noopener noreferrer" className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-0.5 mt-0.5">
                <MaterialIcon name="code" className="w-3" style={{ display: "inline", verticalAlign: "middle" }} />
                github.com/{founder}
              </a>
            </div>
          </div>
        </div>
      ) : null}
      {collaborators.length > 0 ? (
        <div className="quiet-card p-4 shadow-sm">
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-3">{t.collabCardTitle}</span>
          <div className="grid grid-cols-5 gap-2.5">
            {collaborators.map((name) => (
              <a key={name} href={`https://github.com/${name}`} target="_blank" rel="noopener noreferrer" title={name} className="relative group transition active:scale-95">
                <img src={`https://github.com/${name}.png`} className="avatar-image w-9 h-9 rounded-lg border border-line object-fill shadow-sm transition hover:border-brand" alt="" onError={(e) => { (e.target as HTMLImageElement).src = agentAvatarUrl(name); }} />
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
