"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MaterialIcon } from "./MaterialIcon";
import type { CompanySettings, McpCatalog, McpSecretsResponse } from "../hooks/useOrchestrator";
import { sileo } from "sileo";

type Props = {
  settings: CompanySettings | null;
  mcpCatalog: McpCatalog | null;
  mcpSecrets: McpSecretsResponse | null;
  updateSettings: (payload: CompanySettings) => Promise<void>;
  toggleMcpServer: (name: string) => Promise<void>;
  onComplete: () => void;
  language: string;
};

export function SetupWizard({
  settings,
  mcpCatalog,
  mcpSecrets,
  updateSettings,
  toggleMcpServer,
  onComplete,
  language,
}: Props) {
  const isEs = language === "es";
  const copy = isEs ? esCopy : enCopy;

  // Step state
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Profile Step State
  const [companyName, setCompanyName] = useState(settings?.company_name || "DevFoundry");
  const [companySubtitle, setCompanySubtitle] = useState(settings?.company_subtitle || "AI Software Company");
  const [logoBrand, setLogoBrand] = useState(settings?.logo_brand || "");

  // Theme Step State
  const [themeMode, setThemeMode] = useState<"light" | "dark" | "system">("system");

  // Load defaults if settings change
  useEffect(() => {
    if (settings) {
      if (settings.company_name) setCompanyName(settings.company_name);
      if (settings.company_subtitle) setCompanySubtitle(settings.company_subtitle);
      if (settings.logo_brand) setLogoBrand(settings.logo_brand);
      if (settings.theme) {
        // If settings theme is loaded, map it to themeMode. 
        // We'll set system as default unless localStorage has 'company_theme' set specifically to light/dark.
        const storedTheme = localStorage.getItem("company_theme");
        if (storedTheme === "light" || storedTheme === "dark") {
          setThemeMode(storedTheme as any);
        } else {
          setThemeMode("system");
        }
      }
    }
  }, [settings]);

  // Logo uploader
  const fileInputRef = useRef<HTMLInputElement>(null);
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLogoBrand(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Preview or apply theme immediately in browser
  const applyTheme = (theme: "light" | "dark" | "system") => {
    localStorage.setItem("company_theme", theme);
    if (theme === "system") {
      const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (isDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } else if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const selectTheme = (mode: "light" | "dark" | "system") => {
    setThemeMode(mode);
    applyTheme(mode);
  };

  // Go to next step
  const handleNext = async () => {
    if (step === 1) {
      // Validate profile name
      if (!companyName.trim()) {
        sileo.error({
          title: isEs ? "Error de Validación" : "Validation Error",
          description: isEs ? "Por favor ingresa un nombre para la empresa" : "Please enter a company name",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else {
      // Finalize setup step
      try {
        // Update brand metadata and theme
        const resolvedTheme = themeMode === "system" 
          ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
          : themeMode;
        
        await updateSettings({
          ...settings,
          company_name: companyName.trim(),
          company_subtitle: companySubtitle.trim(),
          logo_brand: logoBrand || null,
          theme: resolvedTheme as "light" | "dark",
          language: settings?.language || (language as any) || "en",
        });

        // Set locally that we completed the setup wizard
        localStorage.setItem("wizard_completed", "true");
        onComplete();
        
        sileo.success({
          title: isEs ? "¡Configuración Lista!" : "Setup Completed!",
          description: isEs 
            ? "Bienvenido a tu nueva fábrica de software de IA." 
            : "Welcome to your new AI Software Factory.",
        });
      } catch (err: any) {
        sileo.error({
          title: isEs ? "Error al guardar" : "Save Error",
          description: err.message || "Failed to save initial setup settings",
        });
      }
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  // Extract MCP servers
  const mcpServers = Object.entries(mcpCatalog?.servers || {}).map(([name, srv]) => ({
    name,
    ...srv,
  }));

  return (
    <div className="relative min-h-[calc(100vh-30px)] w-full flex flex-col justify-between bg-background text-text overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 select-none transition-colors duration-200">
      {/* Background ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand/10 blur-[120px] dark:bg-brand/5" />
        <div className="absolute bottom-10 right-10 w-[300px] h-[300px] rounded-full bg-info/10 blur-[100px] dark:bg-info/5" />
      </div>

      {/* Main wizard shell */}
      <div className="relative max-w-4xl w-full mx-auto my-auto flex flex-col items-center">
        {/* Header Branding */}
        <div className="flex flex-col items-center text-center mb-5">
          <img src="/logo.png" className="w-12 h-12 object-contain mb-3 drop-shadow-sm" alt="DevFoundry Logo" />
          <h2 className="text-3xl font-black tracking-tight text-text-strong">
            {copy.wizardTitle}
          </h2>
          <p className="mt-2 text-sm text-text-muted max-w-md">
            {copy.wizardSubtitle}
          </p>
        </div>

        {/* Horizontal Progress bar */}
        <div className="w-full max-w-md flex items-center justify-between mb-6 relative">
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-line -translate-y-1/2 z-0" />
          
          {/* Active progress track */}
          <div 
            className="absolute top-1/2 left-0 h-[2px] bg-brand -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${(step - 1) * 50}%` }}
          />

          {[1, 2, 3].map((s) => {
            const active = step >= s;
            const current = step === s;
            return (
              <button
                key={s}
                onClick={() => {
                  // Only allow jumping back, not forward past validation
                  if (s < step) setStep(s as any);
                }}
                disabled={s >= step}
                className={`relative z-10 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-all duration-300 ${
                  current
                    ? "border-brand bg-brand text-white ring-4 ring-brand/15"
                    : active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line bg-surface text-text-muted"
                }`}
              >
                {s < step ? (
                  <MaterialIcon name="check" className="w-3.5" />
                ) : (
                  s
                )}
                <span className="absolute top-10 whitespace-nowrap text-[10px] font-black uppercase tracking-wider text-text-muted">
                  {s === 1 ? copy.step1Name : s === 2 ? copy.step2Name : copy.step3Name}
                </span>
              </button>
            );
          })}
        </div>

        {/* Steps Content wrapper with Framer Motion transitions */}
        <div className="w-full max-w-2xl bg-surface/50 border border-line rounded-2xl shadow-2xl backdrop-blur-md p-5 sm:p-6 min-h-[340px] flex flex-col justify-between transition-all duration-300">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-lg font-bold text-text-strong">{copy.profileHeading}</h3>
                  <p className="text-xs text-text-muted mt-1">{copy.profileSubheading}</p>
                </div>

                <div className="grid gap-6 sm:grid-cols-[100px_1fr] items-start">
                  {/* Brand Logo Upload */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative group flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-dashed border-line-strong bg-surface-muted/40 text-text-muted hover:border-brand/50 hover:bg-surface transition-all">
                      {logoBrand ? (
                        <img src={logoBrand} className="h-full w-full object-cover" alt="Brand Logo" />
                      ) : (
                        <MaterialIcon name="image" className="w-8 text-text-muted" />
                      )}
                      
                      {logoBrand && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLogoBrand("");
                          }}
                          className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white"
                          title={isEs ? "Eliminar Logo" : "Remove Logo"}
                        >
                          <MaterialIcon name="delete" className="w-5" />
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[11px] font-bold text-brand hover:text-brand-strong transition"
                    >
                      {logoBrand ? copy.changeLogo : copy.uploadLogo}
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* Text inputs */}
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-strong uppercase tracking-wider">
                        {copy.companyNameLabel} <span className="text-danger">*</span>
                      </label>
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="e.g. DevFoundry"
                        className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-text-strong uppercase tracking-wider">
                        {copy.companySubtitleLabel}
                      </label>
                      <input
                        type="text"
                        value={companySubtitle}
                        onChange={(e) => setCompanySubtitle(e.target.value)}
                        placeholder="e.g. AI Software Company"
                        className="w-full rounded-xl border border-line bg-background px-4 py-3 text-sm text-text-strong outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-lg font-bold text-text-strong">{copy.themeHeading}</h3>
                  <p className="text-xs text-text-muted mt-1">{copy.themeSubheading}</p>
                </div>

                {/* Theme Selector visual cards */}
                <div className="grid gap-4 sm:grid-cols-3">
                  {/* System Theme Card */}
                  <button
                    type="button"
                    onClick={() => selectTheme("system")}
                    className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 flex flex-col justify-between min-h-[160px] ${
                      themeMode === "system"
                        ? "border-brand bg-brand/5 shadow-lg ring-1 ring-brand"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${themeMode === "system" ? "bg-brand/20 text-brand" : "bg-surface-muted text-text-muted"}`}>
                        <MaterialIcon name="computer" className="w-4" />
                      </span>
                      {themeMode === "system" && (
                        <MaterialIcon name="check" className="w-4 text-brand" />
                      )}
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-text-strong">{copy.themeSystem}</span>
                      <span className="mt-1 block text-[10px] text-text-muted leading-relaxed">
                        {copy.themeSystemDetail}
                      </span>
                    </div>
                    {/* Visual mockup representation */}
                    <div className="absolute -bottom-4 -right-4 h-12 w-20 bg-gradient-to-tr from-surface border-t border-l border-line rounded-tl-lg overflow-hidden flex">
                      <div className="w-1/3 bg-surface-muted/50 border-r border-line" />
                      <div className="flex-1 bg-background flex flex-col p-1.5 space-y-1">
                        <div className="h-1 w-full bg-line rounded-sm" />
                        <div className="h-1 w-2/3 bg-line rounded-sm" />
                      </div>
                    </div>
                  </button>

                  {/* Light Theme Card */}
                  <button
                    type="button"
                    onClick={() => selectTheme("light")}
                    className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 flex flex-col justify-between min-h-[160px] ${
                      themeMode === "light"
                        ? "border-brand bg-brand/5 shadow-lg ring-1 ring-brand"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${themeMode === "light" ? "bg-brand/20 text-brand" : "bg-surface-muted text-text-muted"}`}>
                        <MaterialIcon name="light_mode" className="w-4" />
                      </span>
                      {themeMode === "light" && (
                        <MaterialIcon name="check" className="w-4 text-brand" />
                      )}
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-text-strong">{copy.themeLight}</span>
                      <span className="mt-1 block text-[10px] text-text-muted leading-relaxed">
                        {copy.themeLightDetail}
                      </span>
                    </div>
                    {/* Visual mockup representation */}
                    <div className="absolute -bottom-4 -right-4 h-12 w-20 bg-white border-t border-l border-neutral-200 rounded-tl-lg overflow-hidden flex">
                      <div className="w-1/3 bg-neutral-100 border-r border-neutral-200" />
                      <div className="flex-1 bg-neutral-50 flex flex-col p-1.5 space-y-1">
                        <div className="h-1 w-full bg-neutral-200 rounded-sm" />
                        <div className="h-1 w-2/3 bg-neutral-200 rounded-sm" />
                      </div>
                    </div>
                  </button>

                  {/* Dark Theme Card */}
                  <button
                    type="button"
                    onClick={() => selectTheme("dark")}
                    className={`relative overflow-hidden rounded-xl border p-4 text-left transition-all duration-300 flex flex-col justify-between min-h-[160px] ${
                      themeMode === "dark"
                        ? "border-brand bg-brand/5 shadow-lg ring-1 ring-brand"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${themeMode === "dark" ? "bg-brand/20 text-brand" : "bg-surface-muted text-text-muted"}`}>
                        <MaterialIcon name="dark_mode" className="w-4" />
                      </span>
                      {themeMode === "dark" && (
                        <MaterialIcon name="check" className="w-4 text-brand" />
                      )}
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-text-strong">{copy.themeDark}</span>
                      <span className="mt-1 block text-[10px] text-text-muted leading-relaxed">
                        {copy.themeDarkDetail}
                      </span>
                    </div>
                    {/* Visual mockup representation */}
                    <div className="absolute -bottom-4 -right-4 h-12 w-20 bg-[#181818] border-t border-l border-zinc-800 rounded-tl-lg overflow-hidden flex">
                      <div className="w-1/3 bg-[#141414] border-r border-zinc-850" />
                      <div className="flex-1 bg-[#101010] flex flex-col p-1.5 space-y-1">
                        <div className="h-1 w-full bg-zinc-800 rounded-sm" />
                        <div className="h-1 w-2/3 bg-zinc-850 rounded-sm" />
                      </div>
                    </div>
                  </button>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div>
                  <h3 className="text-lg font-bold text-text-strong">{copy.mcpHeading}</h3>
                  <p className="text-xs text-text-muted mt-1">{copy.mcpSubheading}</p>
                </div>

                {/* MCP Grid list */}
                <div className="grid gap-3 sm:grid-cols-2 max-h-[260px] overflow-y-auto pr-1">
                  {mcpServers.map((server) => {
                    const hasMissingSecrets = (server.env_keys || []).filter(
                      (key) => !mcpSecrets?.secrets?.[key]?.configured
                    ).length > 0;

                    return (
                      <div
                        key={server.name}
                        className={`flex items-start justify-between p-3.5 rounded-xl border bg-surface transition-all ${
                          server.enabled 
                            ? "border-brand bg-brand/5" 
                            : "border-line hover:border-line-strong hover:bg-surface-muted/30"
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${server.enabled ? 'bg-brand/20 text-brand' : 'bg-surface-muted text-text-muted'}`}>
                            <MaterialIcon name="extension" className="w-4" />
                          </span>
                          <div className="min-w-0">
                            <span className="block text-xs font-bold text-text-strong truncate">
                              {server.display_name || server.name}
                            </span>
                            <span className="mt-0.5 line-clamp-1 block text-[10px] text-text-muted leading-tight">
                              {server.description || copy.mcpDefaultDesc}
                            </span>
                            {server.enabled && hasMissingSecrets && (
                              <span className="inline-flex items-center gap-1 mt-1 text-[8px] text-danger font-black uppercase tracking-wider bg-danger/10 px-1.5 py-0.5 rounded">
                                <MaterialIcon name="warning" className="w-2.5" />
                                {copy.secretsMissing}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <button
                          type="button"
                          onClick={() => toggleMcpServer(server.name)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-250 ease-in-out focus:outline-none ${
                            server.enabled ? "bg-brand" : "bg-line"
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-250 ease-in-out ${
                              server.enabled ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Controls button footer */}
          <div className="mt-5 pt-4 border-t border-line flex items-center justify-between">
            <button
              type="button"
              onClick={handleBack}
              disabled={step === 1}
              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                step === 1
                  ? "opacity-0 pointer-events-none"
                  : "text-text-muted bg-surface-muted/60 hover:bg-surface-muted hover:text-text-strong"
              }`}
            >
              <MaterialIcon name="chevron_left" className="w-3.5" />
              {copy.backBtn}
            </button>

            <button
              type="button"
              onClick={handleNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-brand-strong transition shadow-md hover:shadow-lg active:scale-95"
            >
              {step === 3 ? copy.finishBtn : copy.nextBtn}
              {step < 3 && <MaterialIcon name="chevron_right" className="w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Footer copyright */}
      <div className="text-center text-[10px] text-text-muted mt-4">
        &copy; {new Date().getFullYear()} {companyName || "DevFoundry"}. {copy.allRights}
      </div>
    </div>
  );
}

const esCopy = {
  wizardTitle: "Configura tu Fábrica de IA",
  wizardSubtitle: "Completa estos sencillos pasos para preparar tu espacio de trabajo antes de crear tu primer proyecto.",
  step1Name: "Empresa",
  step2Name: "Tema",
  step3Name: "MCP",
  profileHeading: "Identidad Corporativa",
  profileSubheading: "Ingresa el nombre, subtítulo y logo de tu empresa de desarrollo. Si deseas, puedes dejar los valores por defecto.",
  uploadLogo: "Subir logo",
  changeLogo: "Cambiar logo",
  companyNameLabel: "Nombre de la empresa",
  companySubtitleLabel: "Subtítulo / Eslogan",
  themeHeading: "Tema de la Interfaz",
  themeSubheading: "Elige la apariencia visual preferida para tu panel operativo. Puedes cambiarla en cualquier momento.",
  themeSystem: "Tema del Sistema",
  themeSystemDetail: "Se adapta automáticamente al tema de tu sistema operativo.",
  themeLight: "Modo Claro",
  themeLightDetail: "Limpio y claro, ideal para entornos muy iluminados.",
  themeDark: "Modo Oscuro",
  themeDarkDetail: "Elegante y atenuado, ideal para sesiones de desarrollo prolongadas.",
  mcpHeading: "Servidores MCP (Integraciones)",
  mcpSubheading: "Selecciona y activa las herramientas MCP que los agentes usarán por defecto para escribir código y acceder a archivos.",
  mcpDefaultDesc: "Expone integraciones y comandos para tus agentes de IA.",
  secretsMissing: "Faltan Secretos",
  nextBtn: "Siguiente",
  backBtn: "Atrás",
  finishBtn: "Completar Configuración",
  allRights: "Todos los derechos reservados.",
};

const enCopy = {
  wizardTitle: "Configure your AI Factory",
  wizardSubtitle: "Complete these simple steps to prepare your workspace before creating your first project.",
  step1Name: "Company",
  step2Name: "Theme",
  step3Name: "MCP",
  profileHeading: "Corporate Identity",
  profileSubheading: "Enter your software company's name, subtitle, and brand logo. Leave defaults if you prefer.",
  uploadLogo: "Upload logo",
  changeLogo: "Change logo",
  companyNameLabel: "Company name",
  companySubtitleLabel: "Subtitle / Tagline",
  themeHeading: "Interface Theme",
  themeSubheading: "Choose your preferred layout appearance for the operating panel. You can change this anytime.",
  themeSystem: "System Sync",
  themeSystemDetail: "Automatically adjusts to your operating system theme preference.",
  themeLight: "Light Mode",
  themeLightDetail: "Clean and bright, ideal for high-light environments.",
  themeDark: "Dark Mode",
  themeDarkDetail: "Sleek and dimmed, perfect for long-run development sessions.",
  mcpHeading: "MCP Servers (Integrations)",
  mcpSubheading: "Select and enable the default MCP servers that agents will use to write code and read files.",
  mcpDefaultDesc: "Exposes tool integrations and commands to your AI agents.",
  secretsMissing: "Secrets Missing",
  nextBtn: "Next",
  backBtn: "Back",
  finishBtn: "Complete Setup",
  allRights: "All rights reserved.",
};
