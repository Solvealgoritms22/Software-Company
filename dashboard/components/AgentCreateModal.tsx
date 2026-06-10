import { FormEvent } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { MenuSelect } from "./MenuSelect";
import { MultiSelect } from "./MultiSelect";
import { ToolTreeSelect, type TreeNode } from "./ToolTreeSelect";
import { MODELS_BY_PROVIDER, PROVIDER_OPTIONS, REASONING_OPTIONS, SEXO_OPTIONS, handleImageUpload, listToText, textToList } from "./agentSettingsData";

type Option = { value: string; label: string };

type Values = {
  id: string;
  name: string;
  displayName: string;
  sexo: string;
  avatar: string;
  provider: string;
  model: string;
  fallback: string;
  reasoningEffort: string;
  responsibilities: string;
  skills: string;
  tools: string;
  deliverables: string;
};

type Setters = {
  id: (value: string) => void;
  name: (value: string) => void;
  displayName: (value: string) => void;
  sexo: (value: string) => void;
  avatar: (value: string) => void;
  provider: (value: string) => void;
  model: (value: string) => void;
  fallback: (value: string) => void;
  reasoningEffort: (value: string) => void;
  responsibilities: (value: string) => void;
  skills: (value: string) => void;
  tools: (value: string) => void;
  deliverables: (value: string) => void;
};

type Props = {
  open: boolean;
  error: string;
  values: Values;
  setters: Setters;
  skillOptions: Option[];
  deliverableOptions: Option[];
  treeNodes: TreeNode[];
  onClose: () => void;
  onSubmit: (event: FormEvent) => void;
  onOpenGallery: () => void;
  language?: "en" | "es";
};

const translations = {
  en: {
    createTitle: "Create New Agent",
    createSub: "Configure a new AI team member.",
    agentId: "Agent ID",
    name: "Name",
    displayName: "Display Name",
    sex: "Sex",
    avatar: "Avatar",
    uploadPhoto: "Upload Photo",
    gallery: "Gallery",
    llmProvider: "LLM Provider",
    primaryModel: "Primary Model",
    fallbackModel: "Fallback Model",
    reasoningEffort: "Reasoning Effort",
    instructions: "Instructions (Responsibilities)",
    writeInstructions: "Write instructions...",
    skills: "Skills",
    deliverables: "Deliverables",
    configureTools: "Configure Tools (MCP)",
    cancel: "Cancel",
    createAgent: "Create Agent",
    placeholderId: "e.g. product_manager",
    placeholderName: "Anna"
  },
  es: {
    createTitle: "Crear Nuevo Agente",
    createSub: "Configura un nuevo miembro del equipo de IA.",
    agentId: "ID del Agente",
    name: "Nombre",
    displayName: "Display Name",
    sex: "Sexo",
    avatar: "Avatar",
    uploadPhoto: "Subir Foto",
    gallery: "Galeria",
    llmProvider: "Proveedor LLM",
    primaryModel: "Modelo Principal",
    fallbackModel: "Modelo Fallback",
    reasoningEffort: "Reasoning Effort",
    instructions: "Instrucciones (Responsibilities)",
    writeInstructions: "Escribe las instrucciones...",
    skills: "Skills",
    deliverables: "Entregables",
    configureTools: "Configure Tools (MCP)",
    cancel: "Cancelar",
    createAgent: "Crear Agente",
    placeholderId: "ej. product_manager",
    placeholderName: "Ana"
  }
};

export function AgentCreateModal({ open, error, values, setters, skillOptions, deliverableOptions, treeNodes, onClose, onSubmit, onOpenGallery, language = "en" }: Props) {
  const t = translations[language];
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface rounded-xl border border-line shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col scale-in">
        <div className="flex items-center justify-between border-b border-line bg-surface-muted px-6 py-4 rounded-t-xl">
          <div>
            <h3 className="text-base font-bold text-text-strong">{t.createTitle}</h3>
            <p className="text-[10px] text-text-muted font-medium">{t.createSub}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg border border-line bg-surface text-text-muted hover:text-danger transition">
            <MaterialIcon name="close" className="w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error ? <div className="premium-alert premium-alert-danger text-xs font-medium">{error}</div> : null}
          <div className="grid grid-cols-3 gap-4">
            <Input label={t.agentId} value={values.id} onChange={setters.id} placeholder={t.placeholderId} required />
            <Input label={t.name} value={values.name} onChange={setters.name} placeholder={t.placeholderName} required />
            <Input label={t.displayName} value={values.displayName} onChange={setters.displayName} placeholder="Product Manager" required />
            <div className="flex flex-col">
              <span className="mb-2 block text-xs font-semibold text-text-strong">{t.sex}</span>
              <MenuSelect options={SEXO_OPTIONS} value={values.sexo} onChange={setters.sexo} />
            </div>
          </div>

          <div className="flex items-start gap-4 rounded-lg border border-line bg-surface-muted p-4">
            <div className="avatar-surface flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-line">
              {values.avatar ? <img src={values.avatar} className="avatar-image h-full w-full object-fill" alt="" /> : <MaterialIcon name="person" className="w-8 text-text-muted" />}
            </div>
            <div className="flex-1 space-y-2">
              <span className="block text-xs font-semibold text-text-strong">{t.avatar}</span>
              <input value={values.avatar} onChange={(e) => setters.avatar(e.target.value)} placeholder="https://..." className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand" />
              <div className="flex gap-2">
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong shadow-sm transition hover:border-brand hover:text-brand">
                  <MaterialIcon name="upload" className="w-4" />
                  {t.uploadPhoto}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) handleImageUpload(file, setters.avatar); }} />
                </label>
                <button type="button" onClick={onOpenGallery} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-xs font-semibold text-text-strong shadow-sm transition hover:border-brand hover:text-brand">
                  <MaterialIcon name="image" className="w-4" />
                  {t.gallery}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <SelectField label={t.llmProvider} options={PROVIDER_OPTIONS} value={values.provider} onChange={setters.provider} />
            <ModelField provider={values.provider} value={values.model} onChange={setters.model} label={t.primaryModel} />
            <Input label={t.fallbackModel} value={values.fallback} onChange={setters.fallback} placeholder="deepseek-chat" />
            <SelectField label={t.reasoningEffort} options={REASONING_OPTIONS} value={values.reasoningEffort} onChange={setters.reasoningEffort} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-4">
              <Area label={t.instructions} value={values.responsibilities} onChange={setters.responsibilities} placeholder={t.writeInstructions} />
              <MultiField label={t.skills} options={skillOptions} value={values.skills} onChange={setters.skills} />
              <MultiField label={t.deliverables} options={deliverableOptions} value={values.deliverables} onChange={setters.deliverables} />
            </div>
            <ToolTreeSelect nodes={treeNodes} selectedIds={textToList(values.tools).map((tool) => `tool:${tool}`)} onChange={(selected) => setters.tools(listToText(selected.filter((id) => id.startsWith("tool:")).map((id) => id.replace("tool:", ""))))} title={t.configureTools} />
          </div>

          <div className="flex justify-end gap-2 border-t border-line pt-4 mt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-line bg-surface px-4 py-2 text-xs font-semibold text-text-strong transition hover:bg-surface-muted">{t.cancel}</button>
            <button type="submit" className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-surface shadow-sm transition hover:bg-brand-strong">{t.createAgent}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder, required }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean }) {
  return (
    <label className="block text-xs font-semibold text-text-strong">
      {label}
      <input required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand" />
    </label>
  );
}

function Area({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label className="block text-xs font-semibold text-text-strong">
      {label}
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-2 min-h-32 w-full rounded-lg border border-line bg-surface px-3 py-2 text-xs text-text-strong outline-none transition focus:border-brand" />
    </label>
  );
}

function SelectField({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (value: string) => void }) {
  return <div className="flex flex-col"><span className="mb-2 block text-xs font-semibold text-text-strong">{label}</span><MenuSelect options={options} value={value} onChange={onChange} /></div>;
}

function ModelField({ provider, value, onChange, label }: { provider: string; value: string; onChange: (value: string) => void; label: string }) {
  if (["ollama", "lmstudio", "vllm"].includes(provider)) return <Input label={label} value={value} onChange={onChange} placeholder="Ej. llama3.2, mistral..." required />;
  return <SelectField label={label} options={MODELS_BY_PROVIDER[provider] || []} value={value} onChange={onChange} />;
}

function MultiField({ label, options, value, onChange }: { label: string; options: Option[]; value: string; onChange: (value: string) => void }) {
  return <div className="flex flex-col"><span className="mb-2 block text-xs font-semibold text-text-strong">{label}</span><MultiSelect options={options} selected={textToList(value)} onChange={(arr) => onChange(listToText(arr))} /></div>;
}
