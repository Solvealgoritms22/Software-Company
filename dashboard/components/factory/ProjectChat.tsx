import { FormEvent, useEffect, useRef } from "react";
import type { useOrchestrator } from "../../hooks/useOrchestrator";
import { MaterialIcon } from "../MaterialIcon";
import { agentAvatarUrl } from "../agentSettingsData";

type Orchestrator = ReturnType<typeof useOrchestrator>;

type Props = {
  project: Orchestrator["project"];
  registry: Orchestrator["agentRegistry"];
  chatMessage: string;
  setChatMessage: (value: string) => void;
  isChatSending: boolean;
  setIsChatSending: (value: boolean) => void;
  sendChat: (id: string, message: string) => Promise<void>;
};

export function ProjectChat({ 
  project, 
  registry, 
  chatMessage, 
  setChatMessage, 
  isChatSending, 
  setIsChatSending, 
  sendChat 
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [project?.logs]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [chatMessage]);

  if (!project) return null;

  const logs = [...(project.logs || [])].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const agents = registry?.agents || {};

  async function submitChat(event?: FormEvent<HTMLFormElement>) {
    if (event) event.preventDefault();
    if (!project || !chatMessage.trim() || isChatSending) return;
    setIsChatSending(true);
    try {
      await sendChat(project.id, chatMessage);
      setChatMessage("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    } finally {
      setIsChatSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitChat();
    }
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-background">
      <style>{`
        @keyframes chatAppear {
          0% { opacity: 0; transform: translateY(10px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-chat-message {
          animation: chatAppear 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-8 flex flex-col gap-6"
      >
        {logs.map((log) => {
          const isUser = log.agent === "user" || log.agent === "founder";
          const agentDetails = agents[log.agent] || {};
          const agentName = isUser ? "You" : (agentDetails.name || log.agent);
          const avatar = isUser ? null : (agentDetails.avatar_url || agentAvatarUrl(agentName));

          return (
            <div 
              key={log.id} 
              className={`flex items-end gap-3 max-w-3xl animate-chat-message ${isUser ? "self-end flex-row-reverse" : "self-start"}`}
            >
              {!isUser && (
                <div className="shrink-0 mb-1">
                  {avatar ? (
                    <img src={avatar} alt={agentName} className="h-8 w-8 rounded-full object-cover border border-line shadow-sm" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-brand/10 text-brand flex items-center justify-center border border-brand/20 shadow-sm">
                      <MaterialIcon name="smart_toy" className="w-4" />
                    </div>
                  )}
                </div>
              )}
              
              <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
                <span className="text-[10px] font-bold text-text-muted mb-1.5 px-1 uppercase tracking-wider">
                  {agentName}
                </span>
                <div 
                  className={`px-5 py-3.5 rounded-2xl text-[13px] leading-relaxed shadow-sm whitespace-pre-wrap font-mono ${
                    isUser 
                      ? "bg-brand text-white rounded-br-sm shadow-brand/20" 
                      : "bg-surface border border-line text-text-strong rounded-bl-sm"
                  }`}
                >
                  {log.message}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Professional Antigravity-style Chat Input */}
      <div className="w-full flex justify-center px-4 pb-6 pt-2 z-20 bg-background/80 backdrop-blur-md">
        <div className="w-full max-w-3xl flex flex-col">
          <form 
            className="relative flex flex-col rounded-2xl border border-line/60 bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all focus-within:border-brand/50 focus-within:ring-4 focus-within:ring-brand/10"
            onSubmit={submitChat}
          >
          <textarea 
            ref={textareaRef}
            placeholder="Itera en este proyecto: solicita cambios, mejoras o correcciones..." 
            value={chatMessage} 
            onChange={(e) => setChatMessage(e.target.value)} 
            onKeyDown={handleKeyDown}
            disabled={isChatSending || project.status === "failed"} 
            className="w-full resize-none bg-transparent px-5 py-4 text-[13px] text-text-strong outline-none placeholder:text-text-muted disabled:opacity-50 min-h-[56px] max-h-[200px] overflow-y-auto"
            rows={1}
          />
          <div className="flex items-center justify-between px-3 pb-3 pt-1">
            <div className="flex items-center gap-1 text-text-muted">
              <button type="button" className="p-2 hover:bg-surface-muted rounded-xl transition-colors" title="Adjuntar archivo (Próximamente)">
                <MaterialIcon name="link" className="w-4" />
              </button>
              <button type="button" className="p-2 hover:bg-surface-muted rounded-xl transition-colors hidden sm:block" title="Opciones de contexto (Próximamente)">
                <MaterialIcon name="add" className="w-4" />
              </button>
            </div>
            
            <button 
              type="submit" 
              disabled={!chatMessage.trim() || isChatSending || project.status === "failed"} 
              className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-300 ${
                chatMessage.trim() && !isChatSending && project.status !== "failed"
                  ? "bg-brand text-white shadow-md hover:scale-105 hover:bg-brand/90 hover:shadow-brand/20" 
                  : "cursor-not-allowed bg-surface-muted text-text-muted border border-line/50"
              }`} 
              title="Enviar (Enter)"
            >
              {isChatSending ? (
                <MaterialIcon name="progress_activity" className="w-[18px]" animate="spin" />
              ) : (
                <MaterialIcon name="arrow_upward" className="w-[18px]" />
              )}
            </button>
          </div>
        </form>
        <div className="text-center mt-3 text-[10px] text-text-muted font-medium">
          Los agentes de IA pueden cometer errores. Considera verificar la información importante.
        </div>
        </div>
      </div>
    </div>
  );
}
