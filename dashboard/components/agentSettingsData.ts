export const REASONING_OPTIONS = [
  { value: "none", label: "None" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium (default)" },
  { value: "high", label: "High" },
];

export const PROVIDER_OPTIONS = [
  { value: "openai", label: "OpenAI", iconUrl: "/providers/openai.svg", invertDark: true },
  { value: "anthropic", label: "Anthropic", iconUrl: "/providers/anthropic.svg", invertDark: true },
  { value: "gemini", label: "Google Gemini", iconUrl: "/providers/gemini-color.svg" },
  { value: "deepseek", label: "DeepSeek", iconUrl: "/providers/deepseek-color.svg" },
  { value: "azure", label: "Azure AI", iconUrl: "/providers/azureai-color.svg" },
  { value: "grok", label: "xAI Grok", iconUrl: "/providers/grok.svg", invertDark: true },
  { value: "ollama", label: "Ollama", iconUrl: "https://upload.wikimedia.org/wikipedia/commons/1/1a/Ollama_Logo.svg", invertDark: true },
  { value: "lmstudio", label: "LM Studio", iconUrl: "https://cdn.iconscout.com/icon/free/png-256/free-robot-icon-download-in-svg-png-gif-file-formats--chatbot-ai-bot-avatar-user-interface-pack-icons-2651034.png", invertDark: true },
  { value: "vllm", label: "vLLM", iconUrl: "https://vllm.ai/assets/logos/vllm-logo-text-light.png", invertDark: true },
];

export const MODELS_BY_PROVIDER: Record<string, { value: string; label: string }[]> = {
  openai: [
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o-mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "o1-mini", label: "o1-mini" },
    { value: "o1-preview", label: "o1-preview" },
  ],
  anthropic: [
    { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
    { value: "claude-3-opus-latest", label: "Claude 3 Opus" },
  ],
  gemini: [
    { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
  deepseek: [
    { value: "deepseek-chat", label: "DeepSeek V3 (Chat)" },
    { value: "deepseek-reasoner", label: "DeepSeek R1 (Reasoner)" },
  ],
  azure: [
    { value: "gpt-4o", label: "GPT-4o (Azure)" },
    { value: "gpt-4", label: "GPT-4 (Azure)" },
    { value: "gpt-35-turbo", label: "GPT-3.5 Turbo (Azure)" },
  ],
  grok: [
    { value: "grok-beta", label: "Grok Beta" },
    { value: "grok-vision-beta", label: "Grok Vision Beta" },
  ],
  ollama: [
    { value: "llama3.2", label: "Llama 3.2" },
    { value: "llama3.1", label: "Llama 3.1" },
    { value: "mistral", label: "Mistral" },
    { value: "qwen2.5", label: "Qwen 2.5" },
    { value: "deepseek-r1", label: "DeepSeek R1" },
  ],
};

export const SEXO_OPTIONS = [
  { value: "femenino", label: "Femenino" },
  { value: "masculino", label: "Masculino" },
  { value: "no_especificado", label: "No especificado" },
];

export const avatarPresets = Array.from({ length: 50 }, (_, index) => ({
  label: `Avatar ${String(index + 1).padStart(2, "0")}`,
  url: `/avatars/agents/avatar-${String(index + 1).padStart(2, "0")}.png`,
}));

export function agentAvatarUrl(seed: string | undefined | null) {
  const normalized = seed || "agent";
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  return avatarPresets[hash % avatarPresets.length].url;
}

export const groups: Record<string, string[]> = {
  Direccion: ["ceo"],
  Descubrimiento: ["business_analyst", "legal"],
  Arquitectura: ["software_architect", "frontend_architect"],
  Desarrollo: ["senior_backend", "backend_developer", "frontend_developer", "dba"],
  Calidad: ["qa", "security"],
  Operaciones: ["devops", "technical_writer"],
};

export function handleImageUpload(file: File, callback: (base64: string) => void) {
  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
      callback(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
}

export function listToText(value?: string[]) {
  return (value || []).join("\n");
}

export function textToList(value: string) {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}
