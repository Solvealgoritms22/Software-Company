"use client";

import { FormEvent, useEffect, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import type { CompanySettings } from "../hooks/useOrchestrator";
import { MenuSelect } from "./MenuSelect";

type Props = {
  settings: CompanySettings | null;
  onSave: (payload: CompanySettings) => Promise<void>;
  error: string | null;
};

const translations = {
  en: {
    title: "General Configuration",
    subtitle: "Customize your AI Factory brand assets, theme, language, and team profiles.",
    companyName: "Company Settings",
    companySubtitle: "Company Subtitle",
    logoBrand: "Brand Logo",
    logoUpload: "Upload Logo",
    founder: "Founder",
    founderDesc: "Enter founder's GitHub username to display their profile card.",
    collaborators: "Collaborators",
    collabPlaceholder: "torvalds",
    addCollab: "Add",
    theme: "Interface Theme",
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    language: "Default Language",
    langEn: "English",
    langEs: "Spanish",
    save: "Save Changes",
    saved: "Configuration saved successfully!",
    errorSaving: "Error updating settings.",
    collabEmpty: "Please enter a username.",
    founderCardTitle: "Founder Profile",
    collabCardTitle: "Active Team",
    systemPromptTitle: "System Prompt Instructions",
    systemPromptDesc: "Configure the process instructions, MCP expectations, and tool guidelines injected into the system prompt of all agents.",
    policiesTitle: "Policies & Voice",
    toolPolicy: "Tool Execution Policy",
    toolPolicyDesc: "Determine if agent tool executions require human approval.",
    approvalRequired: "Approval Required",
    fullAccess: "Full Access",
    agentVoice: "Agent Voice Conversations",
    agentVoiceDesc: "Enable voice output for active agents in the factory.",
  },
  es: {
    title: "Configuración General",
    subtitle: "Personaliza los recursos de marca, tema, idioma y perfiles del equipo de tu fábrica de IA.",
    companyName: "Configuración de la Compañía",
    companySubtitle: "Subtítulo de la Compañía",
    logoBrand: "Logo de la Marca",
    logoUpload: "Subir Logo",
    founder: "Fundador (Usuario de GitHub)",
    founderDesc: "Ingresa el usuario de GitHub del fundador para mostrar su tarjeta de perfil.",
    collaborators: "Colaboradores (Usuarios de GitHub)",
    collabPlaceholder: "torvalds",
    addCollab: "Agregar",
    theme: "Tema de la Interfaz",
    themeLight: "Modo Claro",
    themeDark: "Modo Oscuro",
    language: "Idioma Predeterminado",
    langEn: "Inglés (US)",
    langEs: "Español (ES)",
    save: "Guardar Cambios",
    saved: "¡Configuración guardada exitosamente!",
    errorSaving: "Error al actualizar la configuración.",
    collabEmpty: "Por favor ingresa un usuario.",
    founderCardTitle: "Perfil del Fundador",
    collabCardTitle: "Equipo Activo",
    systemPromptTitle: "Instrucciones de Prompt de Sistema",
    systemPromptDesc: "Configura las instrucciones de proceso, directrices de herramientas y expectativas de MCP inyectadas en el prompt de sistema de todos los agentes.",
    policiesTitle: "Políticas y Voz",
    toolPolicy: "Política de Ejecución de Herramientas",
    toolPolicyDesc: "Determina si las ejecuciones de herramientas de los agentes requieren aprobación humana.",
    approvalRequired: "Aprobación Requerida",
    fullAccess: "Acceso Completo",
    agentVoice: "Conversaciones por Voz de Agentes",
    agentVoiceDesc: "Activa la salida de voz para los agentes activos en la fábrica.",
  }
};

function handleLogoUpload(file: File, callback: (base64: string) => void) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Center crop and resize
        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
        const dataUrl = canvas.toDataURL("image/png");
        callback(dataUrl);
      }
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}

interface SocialLink {
  platform: string;
  url: string;
}

const platformMetadata: Record<string, { label: string; iconName: string; placeholder: string }> = {
  twitter: { label: "Twitter / X", iconName: "alternate_email", placeholder: "https://twitter.com/usuario" },
  linkedin: { label: "LinkedIn", iconName: "work", placeholder: "https://linkedin.com/in/usuario" },
  github: { label: "GitHub", iconName: "code", placeholder: "https://github.com/usuario" },
  youtube: { label: "YouTube", iconName: "play_circle", placeholder: "https://youtube.com/@canal" },
  instagram: { label: "Instagram", iconName: "photo_camera", placeholder: "https://instagram.com/usuario" },
  facebook: { label: "Facebook", iconName: "groups", placeholder: "https://facebook.com/usuario" },
  link: { label: "Enlace web", iconName: "link", placeholder: "https://ejemplo.com" }
};

function parseSocialLinks(socialStr: string): SocialLink[] {
  if (!socialStr) return [];
  return socialStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url) => {
      let platform = "link";
      const lower = url.toLowerCase();
      if (lower.includes("twitter.com") || lower.includes("x.com")) {
        platform = "twitter";
      } else if (lower.includes("linkedin.com")) {
        platform = "linkedin";
      } else if (lower.includes("github.com")) {
        platform = "github";
      } else if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
        platform = "youtube";
      } else if (lower.includes("instagram.com")) {
        platform = "instagram";
      } else if (lower.includes("facebook.com")) {
        platform = "facebook";
      }
      return { platform, url };
    });
}

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
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 4000);
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
                <MaterialIcon name="public" className="w-4 text-brand" />
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
                            aria-label="Eliminar enlace"
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
                        className="w-4 h-4 rounded-full object-cover"
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${c}`;
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

          {/* Right Column: Theme & Localization & Previews */}
          <div className="space-y-6">
            {/* Theme & Language selector */}
            <div className="quiet-card p-5 space-y-4 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <MaterialIcon name="public" className="w-4 text-brand" />
                System & Theme Settings
              </h3>

              {/* Theme Selection */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-text-muted">{t.theme}</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setTheme("light")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition shadow-sm ${
                      theme === "light"
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-line bg-surface hover:bg-surface-muted text-text-muted"
                    }`}
                  >
                    <MaterialIcon name="light_mode" className="w-4" />
                    {t.themeLight}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme("dark")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition shadow-sm ${
                      theme === "dark"
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-line bg-surface hover:bg-surface-muted text-text-muted"
                    }`}
                  >
                    <MaterialIcon name="dark_mode" className="w-4" />
                    {t.themeDark}
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-2 pt-2 border-t border-line">
                <span className="block text-xs font-semibold text-text-muted">{t.language}</span>
                <MenuSelect 
                  value={language}
                  onChange={(val) => setLanguage(val as "en" | "es")}
                  options={[
                    { value: "en", label: t.langEn, iconUrl: "https://flagcdn.com/w20/us.png" },
                    { value: "es", label: t.langEs, iconUrl: "https://flagcdn.com/w20/es.png" }
                  ]}
                />
              </div>
            </div>

            {/* Profiles Preview Cards */}
            {(founder || collaborators.length > 0) && (
              <div className="space-y-4">
                {/* Founder Preview */}
                {founder && (
                  <div className="quiet-card p-4 shadow-sm border border-brand/20 relative overflow-hidden bg-gradient-to-br from-brand/5 to-transparent">
                    <span className="text-[10px] font-bold text-brand uppercase tracking-wider block mb-3">
                      {t.founderCardTitle}
                    </span>
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://github.com/${founder.trim()}.png`}
                        className="w-12 h-12 rounded-full border border-line object-cover shadow-sm bg-surface"
                        alt=""
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${founder}`;
                        }}
                      />
                      <div className="min-w-0">
                        <div className="font-bold text-sm text-text-strong truncate">{founder}</div>
                        <a 
                          href={`https://github.com/${founder.trim()}`} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-brand hover:underline font-semibold flex items-center gap-0.5 mt-0.5"
                        >
                           <MaterialIcon name="code" className="w-3" style={{ display: 'inline', verticalAlign: 'middle' }} />
                          github.com/{founder}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {/* Team Previews */}
                {collaborators.length > 0 && (
                  <div className="quiet-card p-4 shadow-sm">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-3">
                      {t.collabCardTitle}
                    </span>
                    <div className="grid grid-cols-5 gap-2.5">
                      {collaborators.map((c) => (
                        <a
                          key={c}
                          href={`https://github.com/${c}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={c}
                          className="relative group transition active:scale-95"
                        >
                          <img
                            src={`https://github.com/${c}.png`}
                            className="w-9 h-9 rounded-lg border border-line hover:border-brand object-cover shadow-sm bg-surface transition"
                            alt=""
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${c}`;
                            }}
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Policies & Voice Settings Card */}
            <div className="quiet-card p-5 space-y-4 shadow-sm border border-line">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <MaterialIcon name="verified_user" className="w-4 text-brand" />
                {t.policiesTitle}
              </h3>

              {/* Tool Policy Selector */}
              <div className="space-y-2">
                <span className="block text-xs font-semibold text-text-strong">{t.toolPolicy}</span>
                <span className="block text-[10px] text-text-muted">{t.toolPolicyDesc}</span>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setToolPolicyMode("approval_required")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition shadow-sm ${
                      toolPolicyMode === "approval_required"
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-line bg-surface hover:bg-surface-muted text-text-muted"
                    }`}
                  >
                    {t.approvalRequired}
                  </button>
                  <button
                    type="button"
                    onClick={() => setToolPolicyMode("full_access")}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition shadow-sm ${
                      toolPolicyMode === "full_access"
                        ? "border-brand bg-brand/5 text-brand"
                        : "border-line bg-surface hover:bg-surface-muted text-text-muted"
                    }`}
                  >
                    {t.fullAccess}
                  </button>
                </div>
              </div>

              {/* Agent Voice Toggle */}
              <div className="space-y-2 pt-3 border-t border-line">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-semibold text-text-strong">{t.agentVoice}</span>
                    <span className="block text-[10px] text-text-muted mt-0.5">{t.agentVoiceDesc}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={voiceConversationsEnabled}
                      onChange={(e) => setVoiceConversationsEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-line peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:bg-line peer-checked:bg-brand"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
