"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiBase, apiFetch, orchestratorApiKey } from "../lib/orchestratorApi";
import type { AgentRegistry, ProjectState } from "./useOrchestrator";

type AgentVoiceStatus = "idle" | "speaking" | "backend_unavailable" | "disabled";

function normalizeSexo(value?: string) {
  const text = (value || "no_especificado").toLowerCase();
  if (text.startsWith("f")) return "femenino";
  if (text.startsWith("m")) return "masculino";
  return "no_especificado";
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function buildAgentLine(phaseId: string, status: string, agentName: string, projectStatus?: string) {
  const phase = phaseId.replaceAll("_", " ");
  const firstName = agentName.split(" ")[0];
  const r = Math.floor(Math.random() * 100);

  if (status === "running") {
    const pool = [
      `Hola, por aquí ${firstName}. Empiezo con la fase de ${phase}. Voy avanzando y les aviso de cualquier novedad.`,
      `Aquí ${firstName}. Iniciando con la fase de ${phase}. Los mantendré informados del avance.`,
      `Habla ${firstName}. Me pongo a trabajar en ${phase} ahora mismo. Si surge algún bloqueo, aviso.`,
      `¡Listo! Arrancando con ${phase}. ¡Manos a la obra!`,
      `Hola a todos, soy ${firstName}. Dando inicio a la tarea de ${phase}. Todo marcha en orden.`,
      `Por aquí ${firstName}. Empezando ${phase}. Voy a estar concentrada en esto.`,
      `Qué tal, equipo. Aquí ${firstName}. Inicio la fase de ${phase} en este momento.`,
      `Comenzando con ${phase}. Les aviso si necesito que revisemos algo.`
    ];
    return pool[r % pool.length];
  }

  if (status === "completed") {
    const pool = [
      `La fase de ${phase} ya está completada. Paso el contexto al siguiente responsable.`,
      `Terminé con la fase de ${phase}. Todo listo para el siguiente paso.`,
      `Por aquí ${firstName}. ${phase} completado con éxito. Le paso la posta al siguiente agente.`,
      `Fase de ${phase} finalizada. Todo quedó en orden y guardado.`,
      `Acabo de terminar la fase de ${phase}. Queda todo en línea para continuar.`,
      `Listo, ${phase} completado. Ya pueden proceder con la siguiente fase.`,
      `He finalizado el trabajo en ${phase}. El código y las pruebas están listos.`
    ];
    return pool[r % pool.length];
  }

  if (status === "failed" || projectStatus === "waiting_intervention") {
    const pool = [
      `Atención equipo, encontré un bloqueo en la fase de ${phase}. Necesito revisión antes de poder continuar.`,
      `Por aquí ${firstName}. He detectado un problema en la fase de ${phase}. Necesitamos revisarlo juntos.`,
      `Estoy bloqueada en ${phase}. ¿Alguien me puede dar una mano aquí antes de seguir?`,
      `Surgió un error inesperado en ${phase} que requiere intervención técnica.`,
      `Fase de ${phase} detenida por un error. Quedo a la espera de la revisión del equipo.`,
      `Hola, he tenido un problema en ${phase}. Dejé los detalles en el log para que lo verifiquemos.`
    ];
    return pool[r % pool.length];
  }

  if (projectStatus === "waiting_approval") {
    const pool = [
      `Dejo esto en pausa hasta recibir su aprobación.`,
      `Por aquí ${firstName}. Esperando el visto bueno para continuar con el siguiente paso.`,
      `Fase en pausa. Pendiente de su aprobación en el panel.`,
      `Todo listo por mi parte. A la espera de la firma de aprobación para proceder.`,
      `Quedo atenta a la aprobación para retomar las tareas.`
    ];
    return pool[r % pool.length];
  }

  const pool = [
    `Quedo atenta para la fase de ${phase}.`,
    `Lista y preparada para cuando toque trabajar en ${phase}.`,
    `A la espera de mi turno para arrancar con ${phase}.`,
    `Preparada para tomar el relevo en la fase de ${phase}.`,
    `Por aquí ${firstName}, atenta para empezar en cuanto me asignen ${phase}.`
  ];
  return pool[r % pool.length];
}

function phaseEventKey(projectId: string, phase: ProjectState["phases"][string]) {
  return `${projectId}:${phase.id}:${phase.status}:${phase.completed_at || phase.started_at || ""}:${phase.error || ""}`;
}

function browserVoiceForSexo(sexo: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const spanish = voices.filter((voice) => voice.lang.toLowerCase().startsWith("es"));
  const pool = spanish.length ? spanish : voices;
  if (!pool.length) return null;
  const feminine = sexo === "femenino";
  const preferred = pool.find((voice) => {
    const name = voice.name.toLowerCase();
    return feminine
      ? name.includes("female") || name.includes("mujer") || name.includes("helena") || name.includes("sabina")
      : name.includes("male") || name.includes("hombre") || name.includes("pablo") || name.includes("jorge");
  });
  return preferred || pool[0];
}

export function useAgentVoice({
  enabled,
  project,
  registry,
  language,
}: {
  enabled: boolean;
  project: ProjectState | null;
  registry: AgentRegistry | null;
  language: string;
}) {
  const [speakingAgentId, setSpeakingAgentId] = useState<string | null>(null);
  const [status, setStatus] = useState<AgentVoiceStatus>("disabled");
  const seenEvents = useRef(new Set<string>());
  const initializedProjects = useRef(new Set<string>());
  const audioQueue = useRef<Array<() => Promise<void>>>([]);
  const playing = useRef(false);

  const agents = useMemo(() => registry?.agents || {}, [registry]);
  const voiceEnabled = useMemo(() => Boolean(enabled && project), [enabled, project]);

  const playBrowserFallback = useCallback((text: string, sexo: string, agentId: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      const normalized = normalizeSexo(sexo);
      utterance.voice = browserVoiceForSexo(normalized);
      utterance.lang = language === "es" ? "es-ES" : "en-US";
      utterance.rate = normalized === "masculino" ? 0.94 : 1;
      utterance.pitch = normalized === "femenino" ? 1.08 : normalized === "masculino" ? 0.92 : 1;
      utterance.onstart = () => {
        setSpeakingAgentId(agentId);
        setStatus("speaking");
      };
      utterance.onend = () => {
        setSpeakingAgentId(null);
        setStatus("idle");
        resolve();
      };
      utterance.onerror = () => {
        setSpeakingAgentId(null);
        setStatus("backend_unavailable");
        resolve();
      };
      window.speechSynthesis.speak(utterance);
    });
  }, [language]);

  const playChatterbox = useCallback(async (text: string, sexo: string, agentId: string) => {
    try {
      const key = orchestratorApiKey();
      const params = new URLSearchParams({
        text,
        sexo,
        language,
        agent_id: agentId,
      });
      if (key) {
        params.set("api_key", key);
      }
      const audioUrl = `${apiBase}/voice/stream?${params.toString()}`;

      await new Promise<void>((resolve) => {
        const audio = new Audio(audioUrl);
        audio.onplay = () => {
          setSpeakingAgentId(agentId);
          setStatus("speaking");
        };
        audio.onended = () => {
          setSpeakingAgentId(null);
          setStatus("idle");
          resolve();
        };
        audio.onerror = async () => {
          setSpeakingAgentId(null);
          await playBrowserFallback(text, sexo, agentId);
          resolve();
        };
        void audio.play().catch(async () => {
          await playBrowserFallback(text, sexo, agentId);
          resolve();
        });
      });
    } catch {
      setStatus("backend_unavailable");
      await playBrowserFallback(text, sexo, agentId);
    }
  }, [language, playBrowserFallback]);

  const drainQueue = useCallback(async () => {
    if (playing.current) return;
    playing.current = true;
    while (audioQueue.current.length) {
      const next = audioQueue.current.shift();
      if (next) await next();
    }
    playing.current = false;
  }, []);

  const enqueueLine = useCallback((text: string, sexo: string, agentId: string) => {
    audioQueue.current.push(() => playChatterbox(text, sexo, agentId));
    void drainQueue();
  }, [drainQueue, playChatterbox]);

  useEffect(() => {
    if (!voiceEnabled || !project) {
      setSpeakingAgentId(null);
      setStatus("disabled");
      return;
    }

    setStatus((current) => current === "disabled" ? "idle" : current);

    if (!initializedProjects.current.has(project.id)) {
      for (const phase of Object.values(project.phases)) {
        if (phase.status === "completed") {
          seenEvents.current.add(phaseEventKey(project.id, phase));
        }
      }
      initializedProjects.current.add(project.id);
    }

    for (const phase of Object.values(project.phases)) {
      const eventKey = phaseEventKey(project.id, phase);
      if (seenEvents.current.has(eventKey)) continue;
      if (phase.status !== "running" && phase.status !== "completed" && phase.status !== "failed") continue;
      seenEvents.current.add(eventKey);
      const agent = agents[phase.agent] || {};
      const agentName = agent.name || phase.agent.replaceAll("_", " ");
      const sexo = normalizeSexo(agent.sexo);
      enqueueLine(buildAgentLine(phase.id, phase.status, agentName, project.status), sexo, phase.agent);
    }
  }, [agents, enqueueLine, project, voiceEnabled]);

  useEffect(() => {
    if (enabled) return;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    audioQueue.current = [];
    setSpeakingAgentId(null);
    setStatus("disabled");
  }, [enabled]);

  return { speakingAgentId, voiceStatus: status };
}
