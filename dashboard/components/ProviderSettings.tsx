"use client";

import { useEffect, useRef, useState } from "react";
import type { McpSecretsResponse } from "../hooks/useOrchestrator";
import { sileo } from "sileo";

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', envKey: 'OPENAI_API_KEY', iconUrl: '/providers/openai.svg', url: 'https://platform.openai.com/api-keys', invertDark: true },
  { id: 'anthropic', name: 'Anthropic', envKey: 'ANTHROPIC_API_KEY', iconUrl: '/providers/anthropic.svg', url: 'https://console.anthropic.com/settings/keys', invertDark: true },
  { id: 'gemini', name: 'Google Gemini', envKey: 'GEMINI_API_KEY', iconUrl: '/providers/gemini-color.svg', url: 'https://aistudio.google.com/app/apikey' },
  { id: 'deepseek', name: 'DeepSeek', envKey: 'DEEPSEEK_API_KEY', iconUrl: '/providers/deepseek-color.svg', url: 'https://platform.deepseek.com/api_keys' },
  { id: 'grok', name: 'xAI Grok', envKey: 'XAI_API_KEY', iconUrl: '/providers/grok.svg', url: 'https://console.x.ai/', invertDark: true },
  { 
    id: 'azure', name: 'Azure OpenAI', iconUrl: '/providers/azureai-color.svg', url: 'https://portal.azure.com/',
    subFields: [
      { label: "Clave de API (AZURE_OPENAI_API_KEY)", envKey: "AZURE_OPENAI_API_KEY", placeholder: "6Kh...", isSecret: true },
      { label: "URL del Endpoint (AZURE_OPENAI_ENDPOINT)", envKey: "AZURE_OPENAI_ENDPOINT", placeholder: "https://ejemplo.openai.azure.com/", isSecret: false },
      { label: "Versión de API (AZURE_OPENAI_API_VERSION)", envKey: "AZURE_OPENAI_API_VERSION", placeholder: "2025-01-01-preview", isSecret: false }
    ]
  },
  { 
    id: 'ollama', name: 'Ollama', iconUrl: '/providers/ollama.svg', url: 'https://ollama.com/', invertDark: true,
    subFields: [
      { label: "URL del Endpoint (OLLAMA_BASE_URL)", envKey: "OLLAMA_BASE_URL", placeholder: "http://host.docker.internal:11434/v1", isSecret: false },
      { label: "Clave de API opcional (OLLAMA_API_KEY)", envKey: "OLLAMA_API_KEY", placeholder: "ollama-local-api-key", isSecret: true }
    ]
  },
  { 
    id: 'lmstudio', name: 'LM Studio', iconUrl: '/providers/lmstudio.svg', url: 'https://lmstudio.ai/', invertDark: true,
    subFields: [
      { label: "URL del Endpoint (LMSTUDIO_BASE_URL)", envKey: "LMSTUDIO_BASE_URL", placeholder: "http://host.docker.internal:1234/v1", isSecret: false },
      { label: "Clave de API opcional (LMSTUDIO_API_KEY)", envKey: "LMSTUDIO_API_KEY", placeholder: "lmstudio-local-api-key", isSecret: true }
    ]
  },
  { 
    id: 'vllm', name: 'vLLM', iconUrl: '/providers/vllm.svg', url: 'https://docs.vllm.ai/', invertDark: true,
    subFields: [
      { label: "URL del Endpoint (VLLM_BASE_URL)", envKey: "VLLM_BASE_URL", placeholder: "http://host.docker.internal:8000/v1", isSecret: false },
      { label: "Clave de API opcional (VLLM_API_KEY)", envKey: "VLLM_API_KEY", placeholder: "vllm-...", isSecret: true }
    ]
  }
];

type Props = {
  mcpSecrets: McpSecretsResponse | null;
  saveMcpSecret: (key: string, value: string) => Promise<void>;
  error: string | null;
  language?: "en" | "es";
};

const translations = {
  en: {
    title: "Provider Configuration",
    desc: "Manage the API keys of the different language model providers. These keys are stored locally in the configuration folder and are never sent to third parties.",
    ready: "Ready",
    needsConfig: "Needs Config",
    configured: "Configured",
    missing: "Missing",
    saved: "Saved",
    saving: "Saving...",
    save: "Save",
    getCredentials: "Get your credentials at:",
    getApiKey: "Get your API key at:",
    missingApiKey: "Missing API Key",
    hide: "Hide",
    show: "Show",
    providerConfigured: "Provider configured",
    keySaved: "The key was successfully saved locally.",
    saveError: "Save error",
    orchestratorError: "Could not connect to the orchestrator."
  },
  es: {
    title: "Configuración de Proveedores",
    desc: "Gestiona las claves de API (API Keys) de los distintos proveedores de modelos de lenguaje. Estas claves se almacenan localmente en la carpeta de configuración y nunca se envían a terceros.",
    ready: "Listo",
    needsConfig: "Falta Configurar",
    configured: "Configurado",
    missing: "Falta",
    saved: "Guardado",
    saving: "Guardando...",
    save: "Guardar",
    getCredentials: "Consigue tus credenciales en:",
    getApiKey: "Consigue tu API key en:",
    missingApiKey: "Falta API Key",
    hide: "Ocultar",
    show: "Mostrar",
    providerConfigured: "Proveedor configurado",
    keySaved: "La clave se guardó correctamente de forma local.",
    saveError: "Error al guardar",
    orchestratorError: "No se pudo conectar con el orquestador."
  }
};

export function ProviderSettings({ mcpSecrets, saveMcpSecret, error, language = "en" }: Props) {
  const t = translations[language];
  
  // Local state for revealing API keys
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  
  // Local state for edited keys before saving
  const [editedKeys, setEditedKeys] = useState<Record<string, string>>({});
  const [saveStatus, setSaveStatus] = useState<Record<string, 'idle' | 'saving' | 'saved'>>({});
  const resetTimers = useRef<Record<string, number>>({});

  useEffect(() => {
    return () => {
      Object.values(resetTimers.current).forEach(window.clearTimeout);
      resetTimers.current = {};
    };
  }, []);

  const toggleShowKey = (envKey: string) => {
    setShowKeys(prev => ({ ...prev, [envKey]: !prev[envKey] }));
  };

  const handleKeyChange = (envKey: string, value: string) => {
    setEditedKeys(prev => ({ ...prev, [envKey]: value }));
    setSaveStatus(prev => ({ ...prev, [envKey]: 'idle' }));
  };

  const handleSave = async (envKey: string) => {
    const value = editedKeys[envKey];
    if (value === undefined) return;
    
    setSaveStatus(prev => ({ ...prev, [envKey]: 'saving' }));
    
    try {
      await saveMcpSecret(envKey, value);
      setSaveStatus(prev => ({ ...prev, [envKey]: 'saved' }));
      sileo.success({ title: t.providerConfigured, description: t.keySaved });
    } catch (e) {
      setSaveStatus(prev => ({ ...prev, [envKey]: 'idle' }));
      sileo.error({ title: t.saveError, description: t.orchestratorError });
    }
    
    if (resetTimers.current[envKey]) {
      window.clearTimeout(resetTimers.current[envKey]);
    }
    resetTimers.current[envKey] = window.setTimeout(() => {
      setSaveStatus(prev => ({ ...prev, [envKey]: 'idle' }));
      delete resetTimers.current[envKey];
    }, 2000);
  };

  return (
    <div className="h-full overflow-y-auto p-6 bg-surface/30">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-text-strong flex items-center gap-2">
            <span className="material-symbols-outlined w-6 h-6 text-brand">key</span>
            {t.title}
          </h2>
          <p className="mt-2 text-sm text-text-muted max-w-2xl">
            {t.desc}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm font-medium">
            {error}
          </div>
        )}

        <div className="grid gap-4">
          {PROVIDERS.map((provider) => {
            if (provider.subFields) {
              const subFields = provider.subFields;
              const isConfigured = subFields.every(field => Boolean(mcpSecrets?.secrets?.[field.envKey]?.configured) || field.envKey.endsWith("_BASE_URL"));

              return (
                <div key={provider.id} className="quiet-card p-5 border border-line flex flex-col md:flex-row gap-5 transition-all hover:border-[var(--line-strong)]">
                  <div className="flex items-center gap-4 md:w-64 flex-shrink-0 md:self-start">
                    <div className="w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center p-2 shadow-sm">
                      <img 
                        src={provider.iconUrl} 
                        alt={provider.name} 
                        className={`w-full h-full object-contain ${provider.invertDark ? 'dark:invert' : ''}`} 
                      />
                    </div>
                    <div>
                      <h3 className="font-bold text-text-strong">{provider.name}</h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {isConfigured ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            <span className="material-symbols-outlined w-3 h-3">check</span> {t.ready}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface-muted border border-line px-1.5 py-0.5 rounded">
                            {t.needsConfig}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 flex flex-col gap-4">
                    {subFields.map((field) => {
                      const currentSavedValue = mcpSecrets?.secrets?.[field.envKey]?.masked || mcpSecrets?.secrets?.[field.envKey]?.configured ? "********" : "";
                      const isEdited = editedKeys[field.envKey] !== undefined;
                      const inputValue = isEdited ? editedKeys[field.envKey] : currentSavedValue;
                      const isVisible = showKeys[field.envKey] || !field.isSecret;
                      const status = saveStatus[field.envKey] || 'idle';
                      const hasValue = Boolean(mcpSecrets?.secrets?.[field.envKey]?.configured);

                      return (
                        <div key={field.envKey} className="flex flex-col gap-1.5 bg-surface-muted/40 p-3 rounded-lg border border-line">
                          <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-text-strong">{field.label}</span>
                            <span className={`text-[9px] font-semibold ${hasValue ? 'text-emerald-600 font-bold' : 'text-text-muted'}`}>
                              {hasValue ? t.configured : t.missing}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <input
                                type={isVisible ? "text" : "password"}
                                value={inputValue}
                                onChange={(e) => handleKeyChange(field.envKey, e.target.value)}
                                placeholder={field.placeholder}
                                className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-text-strong outline-none transition focus:border-brand shadow-sm pr-10 font-mono"
                              />
                              {field.isSecret && (
                                <button
                                  type="button"
                                  onClick={() => toggleShowKey(field.envKey)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-strong transition flex items-center justify-center"
                                  title={isVisible ? t.hide : t.show}
                                >
                                  {isVisible ? (
                                    <span className="material-symbols-outlined w-3.5 h-3.5">visibility_off</span>
                                  ) : (
                                    <span className="material-symbols-outlined w-3.5 h-3.5">visibility</span>
                                  )}
                                </button>
                              )}
                            </div>
                            
                            <button
                              onClick={() => handleSave(field.envKey)}
                              disabled={status === 'saving' || (!isEdited && status !== 'saved')}
                              className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                                status === 'saved'
                                  ? 'bg-emerald-600 text-white'
                                  : isEdited
                                  ? 'bg-brand text-surface hover:opacity-90'
                                  : 'bg-surface-muted text-text-muted cursor-not-allowed border border-line'
                              }`}
                            >
                              {status === 'saved' ? (
                                <>{t.saved}</>
                              ) : status === 'saving' ? (
                                <>{t.saving}</>
                              ) : (
                                <>
                                  <span className="material-symbols-outlined w-3.5 h-3.5 animate-bounce-hover">save</span>
                                  {t.save}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="text-xs text-text-muted font-medium">
                      {t.getCredentials} <a href={provider.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">{new URL(provider.url).hostname}</a>
                    </div>
                  </div>
                </div>
              );
            }

            const currentSavedValue = mcpSecrets?.secrets?.[provider.envKey]?.masked || mcpSecrets?.secrets?.[provider.envKey]?.configured ? "********" : "";
            const isEdited = editedKeys[provider.envKey] !== undefined;
            const inputValue = isEdited ? editedKeys[provider.envKey] : currentSavedValue;
            const isVisible = showKeys[provider.envKey];
            const status = saveStatus[provider.envKey] || 'idle';
            const hasKey = Boolean(mcpSecrets?.secrets?.[provider.envKey]?.configured);

            return (
              <div key={provider.id} className="quiet-card p-5 border border-line flex flex-col md:flex-row md:items-center gap-5 transition-all hover:border-[var(--line-strong)]">
                <div className="flex items-center gap-4 md:w-64 flex-shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-surface border border-line flex items-center justify-center p-2 shadow-sm">
                    <img 
                      src={provider.iconUrl} 
                      alt={provider.name} 
                      className={`w-full h-full object-contain ${provider.invertDark ? 'dark:invert' : ''}`} 
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-text-strong">{provider.name}</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {hasKey ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          <span className="material-symbols-outlined w-3 h-3">check</span> {t.configured}
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-text-muted bg-surface-muted border border-line px-1.5 py-0.5 rounded">
                          {t.missingApiKey}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type={isVisible ? "text" : "password"}
                        value={inputValue}
                        onChange={(e) => handleKeyChange(provider.envKey, e.target.value)}
                        placeholder={`sk-... (${provider.envKey})`}
                        className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand shadow-sm pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => toggleShowKey(provider.envKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-text-muted hover:text-text-strong transition flex items-center justify-center"
                        title={isVisible ? t.hide : t.show}
                      >
                        {isVisible ? (
                          <span className="material-symbols-outlined w-4 h-4">visibility_off</span>
                        ) : (
                          <span className="material-symbols-outlined w-4 h-4">visibility</span>
                        )}
                      </button>
                    </div>
                    
                    <button
                      onClick={() => handleSave(provider.envKey)}
                      disabled={status === 'saving' || (!isEdited && status !== 'saved')}
                      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        status === 'saved'
                          ? 'bg-emerald-600 text-white'
                          : isEdited
                          ? 'bg-brand text-surface hover:opacity-90'
                          : 'bg-surface-muted text-text-muted cursor-not-allowed border border-line'
                      }`}
                    >
                      {status === 'saved' ? (
                        <>{t.saved}</>
                      ) : status === 'saving' ? (
                        <>{t.saving}</>
                      ) : (
                        <>
                          <span className="material-symbols-outlined w-4 h-4 animate-bounce-hover">save</span>
                          {t.save}
                        </>
                      )}
                    </button>
                  </div>
                  <div className="text-xs text-text-muted font-medium">
                    {t.getApiKey} <a href={provider.url} target="_blank" rel="noreferrer" className="text-brand hover:underline">{new URL(provider.url).hostname}</a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
