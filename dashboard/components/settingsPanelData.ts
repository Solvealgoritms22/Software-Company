export type SocialLink = {
  platform: string;
  url: string;
};

export const settingsTranslations = {
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
    systemPromptDesc: "Configure process instructions, MCP expectations, and tool guidelines injected into every agent system prompt.",
    policiesTitle: "Policies & Voice",
    toolPolicy: "Tool Execution Policy",
    toolPolicyDesc: "Determine if agent tool executions require human approval.",
    approvalRequired: "Approval Required",
    fullAccess: "Full Access",
    agentVoice: "Agent Voice Conversations",
    agentVoiceDesc: "Enable voice output for active agents in the factory.",
  },
  es: {
    title: "Configuracion General",
    subtitle: "Personaliza marca, tema, idioma y perfiles del equipo de tu fabrica de IA.",
    companyName: "Configuracion de la Compania",
    companySubtitle: "Subtitulo de la Compania",
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
    langEn: "Ingles (US)",
    langEs: "Espanol (ES)",
    save: "Guardar Cambios",
    saved: "Configuracion guardada exitosamente!",
    errorSaving: "Error al actualizar la configuracion.",
    collabEmpty: "Por favor ingresa un usuario.",
    founderCardTitle: "Perfil del Fundador",
    collabCardTitle: "Equipo Activo",
    systemPromptTitle: "Instrucciones de Prompt de Sistema",
    systemPromptDesc: "Configura instrucciones de proceso, herramientas y expectativas MCP inyectadas en todos los agentes.",
    policiesTitle: "Politicas y Voz",
    toolPolicy: "Politica de Ejecucion de Herramientas",
    toolPolicyDesc: "Determina si las ejecuciones de herramientas requieren aprobacion humana.",
    approvalRequired: "Aprobacion Requerida",
    fullAccess: "Acceso Completo",
    agentVoice: "Conversaciones por Voz de Agentes",
    agentVoiceDesc: "Activa la salida de voz para los agentes activos en la fabrica.",
  },
} as const;

export const platformMetadata: Record<string, { label: string; iconName: string; placeholder: string }> = {
  twitter: { label: "Twitter / X", iconName: "alternate_email", placeholder: "https://twitter.com/usuario" },
  linkedin: { label: "LinkedIn", iconName: "work", placeholder: "https://linkedin.com/in/usuario" },
  github: { label: "GitHub", iconName: "code", placeholder: "https://github.com/usuario" },
  youtube: { label: "YouTube", iconName: "play_circle", placeholder: "https://youtube.com/@canal" },
  instagram: { label: "Instagram", iconName: "photo_camera", placeholder: "https://instagram.com/usuario" },
  facebook: { label: "Facebook", iconName: "groups", placeholder: "https://facebook.com/usuario" },
  link: { label: "Enlace web", iconName: "link", placeholder: "https://ejemplo.com" },
};

export function handleLogoUpload(file: File, callback: (base64: string) => void) {
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
      callback(canvas.toDataURL("image/png"));
    };
    img.src = event.target?.result as string;
  };
  reader.readAsDataURL(file);
}

export function parseSocialLinks(socialStr: string): SocialLink[] {
  if (!socialStr) return [];
  return socialStr.split(",").map((item) => item.trim()).filter(Boolean).map((url) => {
    const lower = url.toLowerCase();
    let platform = "link";
    if (lower.includes("twitter.com") || lower.includes("x.com")) platform = "twitter";
    else if (lower.includes("linkedin.com")) platform = "linkedin";
    else if (lower.includes("github.com")) platform = "github";
    else if (lower.includes("youtube.com") || lower.includes("youtu.be")) platform = "youtube";
    else if (lower.includes("instagram.com")) platform = "instagram";
    else if (lower.includes("facebook.com")) platform = "facebook";
    return { platform, url };
  });
}
