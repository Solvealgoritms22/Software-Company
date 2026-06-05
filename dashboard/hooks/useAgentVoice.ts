"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiBase, apiFetch } from "../lib/orchestratorApi";
import type { AgentRegistry, ProjectState } from "./useOrchestrator";

type AgentVoiceStatus = "idle" | "speaking" | "backend_unavailable" | "disabled";

function normalizeSexo(value?: string) {
  const text = (value || "no_especificado").toLowerCase();
  if (text.startsWith("f")) return "femenino";
  if (text.startsWith("m")) return "masculino";
  return "no_especificado";
}

function buildAgentLine(phaseId: string, status: string, agentName: string, projectStatus?: string) {
  const phase = phaseId.replaceAll("_", " ");
  if (status === "running") return `${agentName}: empiezo ${phase}. Voy avanzando y aviso si encuentro un bloqueo.`;
  if (status === "completed") return `${agentName}: ${phase} queda listo. Paso el contexto al siguiente responsable.`;
  if (status === "failed" || projectStatus === "waiting_intervention") return `${agentName}: encontre un bloqueo en ${phase}. Necesito revision antes de continuar.`;
  if (projectStatus === "waiting_approval") return `${agentName}: dejo esto en pausa hasta aprobacion.`;
  return `${agentName}: quedo atento para ${phase}.`;
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
      const response = await apiFetch(`${apiBase}/voice/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agent_id: agentId, text, sexo, language }),
      });
      if (!response.ok) {
        setStatus("backend_unavailable");
        await playBrowserFallback(text, sexo, agentId);
        return;
      }
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const audio = new Audio(audioUrl);
        audio.onplay = () => {
          setSpeakingAgentId(agentId);
          setStatus("speaking");
        };
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setSpeakingAgentId(null);
          setStatus("idle");
          resolve();
        };
        audio.onerror = async () => {
          URL.revokeObjectURL(audioUrl);
          setSpeakingAgentId(null);
          await playBrowserFallback(text, sexo, agentId);
          resolve();
        };
        void audio.play().catch(async () => {
          URL.revokeObjectURL(audioUrl);
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
