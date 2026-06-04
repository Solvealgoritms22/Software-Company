"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, FileText, Github, Globe, Image as ImageIcon, Laptop, Moon, Save, Sun, User, Users, X } from "lucide-react";
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
    systemPromptDesc: "Configure the process instructions, MCP expectations, and tool guidelines injected into the system prompt of all agents."
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
    systemPromptDesc: "Configura las instrucciones de proceso, directrices de herramientas y expectativas de MCP inyectadas en el prompt de sistema de todos los agentes."
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


export function SettingsPanel({ settings, onSave, error }: Props) {
  const [companyName, setCompanyName] = useState("");
  const [companySubtitle, setCompanySubtitle] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactSocial, setContactSocial] = useState("");
  const [logoBrand, setLogoBrand] = useState("");
  const [founder, setFounder] = useState("");
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newCollab, setNewCollab] = useState("");
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [systemPromptMcpInstructions, setSystemPromptMcpInstructions] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");

  // Load current settings into state
  useEffect(() => {
    if (settings) {
      setCompanyName(settings.company_name || "");
      setCompanySubtitle(settings.company_subtitle || "");
      setCompanyDescription(settings.company_description || "");
      setContactEmail(settings.contact_email || "");
      setContactPhone(settings.contact_phone || "");
      setContactSocial(settings.contact_social || "");
      setLogoBrand(settings.logo_brand || "");
      setFounder(settings.founder || "");
      setCollaborators(settings.collaborators || []);
      setTheme(settings.theme || "dark");
      setLanguage(settings.language || "en");
      setSystemPromptMcpInstructions(settings.system_prompt_mcp_instructions || "");
    }
  }, [settings]);

  const activeLang = language || "en";
  const t = translations[activeLang];

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaveStatus("saving");
    try {
      await onSave({
        company_name: companyName,
        company_subtitle: companySubtitle,
        company_description: companyDescription,
        contact_email: contactEmail,
        contact_phone: contactPhone,
        contact_social: contactSocial,
        logo_brand: logoBrand,
        founder: founder.trim(),
        collaborators,
        theme,
        language,
        system_prompt_mcp_instructions: systemPromptMcpInstructions
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

  function addCollaborator() {
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
              <Save className="h-4 w-4" />
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
                <Laptop className="h-4 w-4 text-brand" />
                {t.companyName}
              </h3>
              
              <div className="flex gap-4 items-start">
                {/* Brand Logo Upload Block */}
                <div className="flex flex-col items-center gap-2">
                  <div className="w-20 h-20 rounded-xl border border-line bg-surface-muted flex items-center justify-center overflow-hidden shadow-inner relative group">
                    {logoBrand ? (
                      <img src={logoBrand} className="w-full h-full object-cover" alt="Brand Logo" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-text-muted" />
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
                <Globe className="h-4 w-4 text-brand" />
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
                <label className="block text-xs font-semibold text-text-muted md:col-span-2">
                  Social Media (Twitter/X, LinkedIn)
                  <input
                    type="text"
                    placeholder="twitter.com/devfoundry, linkedin.com/company/devfoundry"
                    value={contactSocial}
                    onChange={(e) => setContactSocial(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none focus:border-brand transition shadow-sm"
                  />
                </label>
              </div>
            </div>

            {/* Team settings card */}
            <div className="quiet-card p-5 space-y-5 shadow-sm">
              <h3 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                <Users className="h-4 w-4 text-brand" />
                Team Profiles
              </h3>

              {/* Founder Username Input */}
              <label className="block text-xs font-semibold text-text-muted">
                {t.founder}
                <div className="relative mt-2 rounded-lg shadow-sm">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <User className="h-4 w-4 text-text-muted" />
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
                        <Github className="h-4 w-4 text-text-muted" />
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
                        <X className="h-3.5 w-3.5" />
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
                <FileText className="h-4 w-4 text-brand" />
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
                <Globe className="h-4 w-4 text-brand" />
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
                    <Sun className="h-4 w-4" />
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
                    <Moon className="h-4 w-4" />
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
                          <Github className="h-3 w-3 inline" />
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
          </div>
        </div>
      </form>
    </div>
  );
}
