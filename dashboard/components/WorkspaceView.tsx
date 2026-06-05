"use client";

import React, { useState, useEffect, useMemo } from "react";
import { FileExplorer } from "./FileExplorer";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { apiFetch } from "../lib/orchestratorApi";
import { type ProjectState } from "../hooks/useOrchestrator";

type Props = {
  data: any;
  apiBase: string;
  theme: "light" | "dark";
  refreshWorkspace?: () => Promise<void>;
  projects?: ProjectState[];
};

export function WorkspaceView({ data, apiBase, theme, refreshWorkspace, projects = [] }: Props) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [originalContent, setOriginalContent] = useState<string>("");
  const [currentContent, setCurrentContent] = useState<string>("");
  const [isDiffMode, setIsDiffMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredData = useMemo(() => {
    if (!data) return data;
    const projectNames = projects.map((p) => p.name.trim().toLowerCase());
    return {
      ...data,
      children: data.children
        ? data.children.filter((child: any) => {
            if (child.type === "dir") {
              return projectNames.includes(child.name.trim().toLowerCase());
            }
            return true;
          })
        : [],
    };
  }, [data, projects]);

  useEffect(() => {
    if (!refreshWorkspace) return;
    const refreshIfVisible = () => {
      if (typeof document === "undefined" || document.visibilityState === "visible") {
        refreshWorkspace();
      }
    };
    const interval = window.setInterval(refreshIfVisible, 10000);
    window.addEventListener("focus", refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [refreshWorkspace]);

  const fetchFile = async (path: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`${apiBase}/workspace/file?path=${encodeURIComponent(path)}`);
      if (res.ok) {
        const data = await res.json();
        setOriginalContent(data.content);
        setCurrentContent(data.content);
        setSelectedFile(path);
      } else {
        setError(`No se pudo abrir el archivo (${res.status}).`);
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo abrir el archivo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    setIsSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`${apiBase}/workspace/file?path=${encodeURIComponent(selectedFile)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: currentContent })
      });
      if (res.ok) {
        setOriginalContent(currentContent);
      } else {
        setError(`No se pudo guardar el archivo (${res.status}).`);
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el archivo.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = originalContent !== currentContent;
  const language = selectedFile ? getLanguageFromPath(selectedFile) : "plaintext";
  const monacoTheme = theme === "dark" ? "vs-dark" : "light";

  return (
    <div className="flex h-full w-full bg-surface">
      <div className="w-[280px] flex-shrink-0 border-r border-line">
        <FileExplorer data={filteredData} onFileSelect={fetchFile} />
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-surface-muted">
        {selectedFile ? (
          <>
            <div className="flex items-center justify-between px-4 py-2 border-b border-line bg-surface">
              <div className="flex items-center gap-2 text-sm font-mono text-text-strong">
                <span className="material-symbols-outlined w-4 h-4 text-brand">code</span>
                {selectedFile}
                {hasChanges && <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" title="Unsaved changes"></span>}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsDiffMode(!isDiffMode)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    isDiffMode ? "bg-brand text-surface" : "bg-surface-muted text-text-muted hover:bg-line"
                  }`}
                  aria-label={isDiffMode ? "Desactivar vista diff" : "Activar vista diff"}
                  title="Toggle Diff Mode"
                >
                  <span className="material-symbols-outlined w-3.5 h-3.5">splitscreen</span>
                  Diff
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-surface hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium transition-colors"
                  aria-label="Guardar archivo"
                >
                  <span className="material-symbols-outlined w-3.5 h-3.5 animate-bounce-hover">save</span>
                  Save
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 text-text-muted hover:text-text-strong rounded-md hover:bg-surface-muted transition-colors flex items-center justify-center"
                  aria-label="Cerrar archivo"
                >
                  <span className="material-symbols-outlined w-4 h-4">close</span>
                </button>
              </div>
            </div>
            <div className="flex-1 relative">
              {error && (
                <div className="absolute right-4 top-4 z-20 rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">
                  {error}
                </div>
              )}
              {isLoading && (
                <div className="absolute inset-0 z-10 flex flex-col p-4 bg-surface/90 backdrop-blur-sm gap-3">
                  <div className="h-4 w-1/3 bg-line rounded animate-pulse" />
                  <div className="h-4 w-1/2 bg-line rounded animate-pulse" />
                  <div className="h-4 w-2/3 bg-line rounded animate-pulse" />
                  <div className="h-4 w-1/4 bg-line rounded animate-pulse ml-8" />
                  <div className="h-4 w-1/2 bg-line rounded animate-pulse ml-8" />
                  <div className="h-4 w-1/5 bg-line rounded animate-pulse" />
                </div>
              )}
              {isDiffMode ? (
                <DiffEditor
                  theme={monacoTheme}
                  original={originalContent}
                  modified={currentContent}
                  language={language}
                  options={{
                    renderSideBySide: true,
                    minimap: { enabled: false },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                  }}
                  onMount={(editor) => {
                    editor.getModifiedEditor().onDidChangeModelContent(() => {
                      setCurrentContent(editor.getModifiedEditor().getValue());
                    });
                  }}
                />
              ) : (
                <Editor
                  theme={monacoTheme}
                  value={currentContent}
                  language={language}
                  onChange={(val) => setCurrentContent(val || "")}
                  options={{
                    minimap: { enabled: true },
                    fontSize: 14,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    wordWrap: "on",
                    padding: { top: 16 }
                  }}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-text-muted">
            <span className="material-symbols-outlined w-16 h-16 mb-4 opacity-20">code</span>
            <p>Selecciona un archivo del explorador.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "py":
      return "python";
    case "json":
      return "json";
    case "yaml":
    case "yml":
      return "yaml";
    case "md":
      return "markdown";
    case "html":
      return "html";
    case "css":
      return "css";
    case "sql":
      return "sql";
    default:
      return "plaintext";
  }
}
