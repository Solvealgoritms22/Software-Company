"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import type { CompanySettings } from "../hooks/useOrchestrator";
import { agentAvatarUrl } from "./agentSettingsData";
import { handleLogoUpload, parseSocialLinks, platformMetadata, settingsTranslations as translations, type SocialLink } from "./settingsPanelData";
import { SettingsSidePanel } from "./SettingsSidePanel";

type Props = {
  settings: CompanySettings | null;
  onSave: (payload: CompanySettings) => Promise<void>;
  error: string | null;
};

export function SettingsPanel({ settings, onSave, error }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [companySubtitle, setCompanySubtitle] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSocial, setContactSocial] = useState("");
  
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [newPlatform, setNewPlatform] = useState("twitter");
  const [newUrl, setNewUrl] = useState("");

  const [logoBrand, setLogoBrand] = useState("");
  const [founder, setFounder] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newCollab, setNewCollab] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [systemPromptMcpInstructions, setSystemPromptMcpInstructions] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [toolPolicyMode, setToolPolicyMode] = useState<"approval_required" | "full_access">("approval_required");
  const [voiceConversationsEnabled, setVoiceConversationsEnabled] = useState(false);
  const saveStatusTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (saveStatusTimer.current !== null) {
        window.clearTimeout(saveStatusTimer.current);
      }
    };
  }, []);

  // Load current settings into state
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || "");
      setCompanySubtitle(settings.company_subtitle || "");
      setCompanyDescription(settings.company_description || "");
      setContactEmail(settings.contact_email || "");
      setContactPhone(settings.contact_phone || "");
      setContactSocial(settings.contact_social || "");
      
      const parsed = parseSocialLinks(settings.contact_social || "");
      setSocialLinks(parsed);

      setLogoBrand(settings.logo_brand || "");
      setFounder(settings.founder || "");
      setCollaborators(settings.collaborators || []);
      setTheme(settings.theme || "dark");
      setLanguage(settings.language || "en");
      setSystemPromptMcpInstructions(settings.system_prompt_mcp_instructions || "");
      setToolPolicyMode(settings.tool_policy_mode || "approval_required");
      setVoiceConversationsEnabled(settings.voice_conversations_enabled || false);
    }
  }, [settings]);

  const activeLang = language || "en";
  const t = translations[activeLang];
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      const socialString = socialLinks
        .map((link) => link.url.trim())
        .filter(Boolean)
        .join(", ");

      await onSave({
        company_name: companyName,
        company_subtitle: companySubtitle,
        company_description: companyDescription,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        contact_social: socialString,
        logo_brand: logoBrand,
        founder: founder.trim(),
        collaborators,
        theme,
        language,
        system_prompt_mcp_instructions: systemPromptMcpInstructions,
        tool_policy_mode: toolPolicyMode,
        voice_conversations_enabled: voiceConversationsEnabled
      });
      localStorage.setItem('company_theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      setSaveStatus("success");
      if (saveStatusTimer.current !== null) {
        window.clearTimeout(saveStatusTimer.current);
      }
      saveStatusTimer.current = window.setTimeout(() => {
        setSaveStatus("idle");
        saveStatusTimer.current = null;
      }, 3000);
    } catch (err) {
      setSaveStatus("error");
      if (saveStatusTimer.current !== null) {
        window.clearTimeout(saveStatusTimer.current);
      }
      saveStatusTimer.current = window.setTimeout(() => {
        setSaveStatus("idle");
        saveStatusTimer.current = null;
      }, 4000);
    }
  }

  function addSocialLink() {
    let url = newUrl.trim();
    if (!url) return;

    if (!/^https?:\/\//i.test(url)) {
      url = "https://" + url;
    }

    setSocialLinks([...socialLinks, { platform: newPlatform, url }]);
    setNewUrl("");
  }

  function removeSocialLink(index: number) {
    setSocialLinks(socialLinks.filter((_, i) => i !== index));
  }  function addCollaborator() {
    const name = newCollab.trim();
    if (!name) return;
    if (!collaborators.includes(name)) {
      setCollaborators([...collaborators, name]);
    }
    setNewCollab("");
  }

  function removeCollaborator(name: string) {
    setCollaborators(collaborators.filter((c) => c !== name));
  }

  return (
    <div className="h-[calc(100vh-73px)] overflow-y-auto scroll-mask-y p-6 bg-surface-muted/10">
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6 view-transition">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-text-strong">{t.title}</h2>
            <p className="text-xs text-text-muted mt-1">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3">
            {saveStatus === "success" && (
              <span className="premium-alert premium-alert-success text-xs font-semibold py-1.5 px-3">
                {t.saved}
              </span>
            )}
            {saveStatus === "error" && (
              <span className="premium-alert premium-alert-danger text-xs font-semibold py-1.5 px-3">
                {t.errorSaving}
              </span>
            )}
            <button
              type="submit"
              disabled={saveStatus === "saving"}
              className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-surface hover:bg-brand-strong active:scale-95 transition shadow-sm"
            >
              <MaterialIcon name="save" className="w-4" />
              {t.save}
            </button>
          </div>
        </div>

        {error && (
          <div className="premium-alert premium-alert-danger text-xs font-medium">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left/Middle: General parameters */}
          <div className="md:col-span-2 space-y-5">
            {/* Company identity card */}
            <div className="quiet-card p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <MaterialIcon name="computer" className="w-4 text-brand" />
                {t.companyName}
              </h3>
              
              <div className="flex gap-4 items-start">
                {/* Brand Logo Upload Block */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-xl border border-line bg-surface-muted flex items-center justify-center overflow-hidden shadow-inner relative group">
                    {logoBrand ? (
                      <img src={logoBrand} className="w-full h-full object-cover" alt="Brand Logo" />
                    ) : (
                      <MaterialIcon name="image" className="w-8 text-text-muted" />
                    )}
                    <label 
                      htmlFor="logo-brand-upload"
                      className="absolute inset-0 bg-black/60 text-white text-[10px] font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition cursor-pointer"
                    >
                      {t.logoUpload}
                    </label>
                  </div>
                  <input
                    type="file"
                    id="logo-brand-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleLogoUpload(file, setLogoBrand);
                      }
                    }}
                  />
                  {logoBrand && (
                    <button 
                      type="button" 
                      onClick={() => setLogoBrand("")} 
                      className="text-[10px] font-bold text-danger hover:underline"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <label className="block text-xs font-semibold text-text-muted">
                    {t.companyName}
                    <input
                      type="text"
                      required
                      placeholder="DevFoundry"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition shadow-sm"
                    />
                  </label>
                  
                  <label className="block text-xs font-semibold text-text-muted mt-2">
                    {t.companySubtitle}
                    <input
                      type="text"
                      placeholder="AI Software Company"
                      value={companySubtitle}
                      onChange={(e) => setCompanySubtitle(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition shadow-sm"
                    />
                  </label>
                  
                  <label className="block text-xs font-semibold text-text-muted mt-4">
                    Company Biography / Description
                    <textarea
                      placeholder="Brief description of the company..."
                      value={companyDescription}
                      onChange={(e) => setCompanyDescription(e.target.value)}
                      rows={3}
                      className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition shadow-sm resize-y"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Contact Settings Card */}
            <div className="quiet-card p-5 space-y-5 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <MaterialIcon name="alternate_email" className="w-4 text-brand" />
                Contact Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-xs font-semibold text-text-muted">
                  Email
                  <input
                    type="email"
                    placeholder="contact@devfoundry.com"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition shadow-sm"
                  />
                </label>
                <label className="block text-xs font-semibold text-text-muted">
                  Phone
                  <input
                    type="text"
                    placeholder="+1 (555) 000-0000"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition shadow-sm"
                  />
                </label>
                <div className="block text-xs font-semibold text-text-muted md:col-span-2">
                  Social Media Links
                  
                  {/* List of existing links */}
                  <div className="mt-3 space-y-2">
                    {socialLinks.map((link, idx) => {
                      const meta = platformMetadata[link.platform] || platformMetadata.link;
                      return (
                        <div key={idx} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface p-2.5 shadow-sm transition hover:border-line-strong">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-muted text-brand">
                              <MaterialIcon name={meta.iconName} className="w-4" />
                            </span>
                            <div className="min-w-0">
                              <span className="block text-[11px] font-bold text-text-strong">{meta.label}</span>
                              <a href={link.url} target="_blank" rel="noopener noreferrer" className="block truncate text-xs text-text-muted hover:underline hover:text-brand">
                                {link.url}
                              </a>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeSocialLink(idx)}
                            className="rounded-md p-1.5 text-text-muted hover:bg-surface-muted hover:text-danger transition"
                            aria-label={language === "es" ? "Eliminar enlace" : "Remove link"}
                          >
                            <MaterialIcon name="delete" className="w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                    {socialLinks.length === 0 && (
                      <p className="text-xs text-text-muted italic py-1">No hay redes sociales agregadas.</p>
                    )}
                  </div>

                  {/* Add social link form */}
                  <div className="mt-4 flex flex-wrap gap-2 items-end">
                    <div className="w-40 shrink-0">
                      <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1.5">Red Social</span>
                      <div className="relative">
                        <select
                          value={newPlatform}
                          onChange={(e) => setNewPlatform(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none focus:border-brand transition shadow-sm pr-8"
                        >
                          {Object.entries(platformMetadata).map(([key, value]) => (
                            <option key={key} value={key}>
                              {value.label}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-text-muted">
                           <MaterialIcon name="expand_more" className="w-3" />
                        </div>
                      </div>
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1.5">Enlace / URL</span>
                      <input
                        type="text"
                        placeholder={platformMetadata[newPlatform]?.placeholder || "https://..."}
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSocialLink();
                          }
                        }}
                        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none focus:border-brand transition shadow-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addSocialLink}
                      className="px-4 py-2 bg-surface-muted border border-line text-text-strong rounded-lg text-xs font-bold hover:bg-line active:scale-95 transition shadow-sm h-[34px]"
                    >
                      Agregar
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Team settings card */}
            <div className="quiet-card p-5 space-y-5 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <MaterialIcon name="group" className="w-4 text-brand" />
                Team Profiles
              </h3>

              {/* Founder Username Input */}
              <label className="block text-xs font-semibold text-text-muted">
                {t.founder}
                <div className="relative mt-2 rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <MaterialIcon name="person" className="w-4 text-text-muted" />
                  </div>
                  <input
                    type="text"
                    placeholder="torvalds"
                    value={founder}
                    onChange={(e) => setFounder(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface pl-9 pr-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition"
                  />
                </div>
                <span className="text-[10px] text-text-muted block mt-1">{t.founderDesc}</span>
              </label>

              {/* Collaborators Input */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-text-muted">
                  {t.collaborators}
                  <div className="flex gap-2 mt-2">
                    <div className="relative flex-1 rounded-lg shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MaterialIcon name="code" className="w-4 text-text-muted" />
                      </div>
                      <input
                        type="text"
                        placeholder={t.collabPlaceholder}
                        value={newCollab}
                        onChange={(e) => setNewCollab(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCollaborator();
                          }
                        }}
                        className="w-full rounded-lg border border-line bg-surface pl-9 pr-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={addCollaborator}
                      className="px-4 py-2 bg-surface-muted border border-line text-text-strong rounded-lg text-xs font-bold hover:bg-line active:scale-95 transition shadow-sm"
                    >
                      {t.addCollab}
                    </button>
                  </div>
                </label>

                {/* Collaborators Tags List */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {collaborators.map((c) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1.5 bg-surface-muted hover:bg-line border border-line text-text-strong px-2.5 py-1 rounded-full text-xs font-semibold transition"
                    >
                      <img
                        src={`https://github.com/${c}.png`}
                        className="avatar-image w-4 h-4 rounded-full object-fill"
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = agentAvatarUrl(c);
                        }}
                      />
                      <a href={`https://github.com/${c}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                        {c}
                      </a>
                      <button
                        type="button"
                        onClick={() => removeCollaborator(c)}
                        className="text-text-muted hover:text-danger ml-0.5 transition"
                      >
                        <MaterialIcon name="close" className="w-3.5" />
                      </button>
                    </span>
                  ))}
                  {collaborators.length === 0 && (
                    <span className="text-xs text-text-muted italic">No collaborators added.</span>
                  )}
                </div>
              </div>
            </div>

            {/* System Prompt Instructions Card */}
            <div className="quiet-card p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <MaterialIcon name="description" className="w-4 text-brand" />
                {t.systemPromptTitle}
              </h3>
              <label className="block text-xs font-semibold text-text-muted">
                <span className="text-text-muted text-[11px] font-normal leading-relaxed block mb-2">{t.systemPromptDesc}</span>
                <textarea
                  value={systemPromptMcpInstructions}
                  onChange={(e) => setSystemPromptMcpInstructions(e.target.value)}
                  rows={14}
                  className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none focus:border-brand font-mono leading-relaxed transition shadow-sm resize-y"
                  placeholder="System prompt instructions..."
                />
              </label>
            </div>
          </div>

          <SettingsSidePanel
            t={t}
            founder={founder}
            collaborators={collaborators}
            theme={theme}
            setTheme={setTheme}
            language={language}
            setLanguage={setLanguage}
            toolPolicyMode={toolPolicyMode}
            setToolPolicyMode={setToolPolicyMode}
            voiceConversationsEnabled={voiceConversationsEnabled}
            setVoiceConversationsEnabled={setVoiceConversationsEnabled}
          />
        </div>
      </form>
    </div>
  );
}
