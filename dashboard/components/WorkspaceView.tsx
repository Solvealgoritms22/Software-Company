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
  language?: string;
};

const emptyStateTranslations = {
  en: {
    title: "Workspace Code Editor",
    subtitle: "Select any file from the explorer on the left to view, edit, or compare project code.",
    guide: "Quick Guide",
    editTitle: "Edit Files",
    editDesc: "Click any file to open the editor. Supports syntax highlighting for TypeScript, Python, HTML, etc.",
    diffTitle: "Compare Changes",
    diffDesc: "Use the Diff button in the editor toolbar to review side-by-side modifications.",
    saveTitle: "Save Workspace",
    saveDesc: "Save changes using the toolbar button or standard keyboard shortcut Ctrl + S.",
  },
  es: {
    title: "Editor de Código del Workspace",
    subtitle: "Selecciona cualquier archivo del explorador a la izquierda para ver, editar o comparar código del proyecto.",
    guide: "Guía Rápida",
    editTitle: "Editar Archivos",
    editDesc: "Haz clic en cualquier archivo para abrir el editor. Soporta resaltado de sintaxis para TypeScript, Python, HTML, etc.",
    diffTitle: "Comparar Cambios",
    diffDesc: "Usa el botón Diff en la barra de herramientas del editor para revisar modificaciones lado a lado.",
    saveTitle: "Guardar Cambios",
    saveDesc: "Guarda los cambios usando el botón en la barra de herramientas o el atajo estándar Ctrl + S.",
  }
};

const uiTranslations = {
  en: {
    openErrorStatus: "Could not open file",
    openError: "Could not open file.",
    saveErrorStatus: "Could not save file",
    saveError: "Could not save file.",
    diffOff: "Disable diff view",
    diffOn: "Enable diff view",
    saveAria: "Save file",
    closeAria: "Close file",
    saveBtn: "Save"
  },
  es: {
    openErrorStatus: "No se pudo abrir el archivo",
    openError: "No se pudo abrir el archivo.",
    saveErrorStatus: "No se pudo guardar el archivo",
    saveError: "No se pudo guardar el archivo.",
    diffOff: "Desactivar vista diff",
    diffOn: "Activar vista diff",
    saveAria: "Guardar archivo",
    closeAria: "Cerrar archivo",
    saveBtn: "Guardar"
  }
};

export function WorkspaceView({ data, apiBase, theme, refreshWorkspace, projects = [], language = "en" }: Props) {
  const t = uiTranslations[language as "en" | "es"] || uiTranslations.en;
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
        setError(`${t.openErrorStatus} (${res.status}).`);
      }
    } catch (e) {
      console.error(e);
      setError(t.openError);
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
        setError(`${t.saveErrorStatus} (${res.status}).`);
      }
    } catch (e) {
      console.error(e);
      setError(t.saveError);
    } finally {
      setIsSaving(false);
    }
  };

  const hasChanges = originalContent !== currentContent;
  const editorLanguage = selectedFile ? getLanguageFromPath(selectedFile) : "plaintext";
  const monacoTheme = theme === "dark" ? "vs-dark" : "light";

  return (
    <div className="flex h-full w-full bg-surface">
      <div className="w-[280px] flex-shrink-0 border-r border-line">
        <FileExplorer data={filteredData} onFileSelect={fetchFile} language={language} />
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
                  aria-label={isDiffMode ? t.diffOff : t.diffOn}
                  title="Toggle Diff Mode"
                >
                  <span className="material-symbols-outlined w-3.5 h-3.5">splitscreen</span>
                  Diff
                </button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand text-surface hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed rounded-md text-xs font-medium transition-colors"
                  aria-label={t.saveAria}
                >
                  <span className="material-symbols-outlined w-3.5 h-3.5 animate-bounce-hover">save</span>
                  {t.saveBtn}
                </button>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="p-1.5 text-text-muted hover:text-text-strong rounded-md hover:bg-surface-muted transition-colors flex items-center justify-center"
                  aria-label={t.closeAria}
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
                  language={editorLanguage}
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
                  language={editorLanguage}
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
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-transparent to-surface/5">
            {/* Glowing Icon Container */}
            <div className="w-16 h-16 rounded-2xl bg-brand/5 border border-brand/10 flex items-center justify-center shadow-lg shadow-brand/2 mb-6 animate-pulse-hover">
              <span className="material-symbols-outlined text-3xl text-brand">folder_open</span>
            </div>

            {/* Title & Subtitle */}
            <h3 className="text-sm font-bold text-text-strong tracking-tight">
              {emptyStateTranslations[language as "en" | "es"]?.title || emptyStateTranslations.en.title}
            </h3>
            <p className="text-xs text-text-muted max-w-sm mt-2 leading-relaxed">
              {emptyStateTranslations[language as "en" | "es"]?.subtitle || emptyStateTranslations.en.subtitle}
            </p>

            {/* Quick Actions Card */}
            <div className="mt-8 quiet-card p-5 max-w-sm w-full space-y-4 shadow-sm bg-surface">
              <h4 className="text-[10px] font-bold text-text-muted uppercase tracking-widest text-left border-b border-line pb-2 mb-2">
                {emptyStateTranslations[language as "en" | "es"]?.guide || emptyStateTranslations.en.guide}
              </h4>
              
              <div className="flex items-start gap-3 text-left">
                <span className="material-symbols-outlined text-sm text-brand mt-0.5">description</span>
                <div>
                  <h5 className="text-xs font-semibold text-text-strong">
                    {emptyStateTranslations[language as "en" | "es"]?.editTitle || emptyStateTranslations.en.editTitle}
                  </h5>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {emptyStateTranslations[language as "en" | "es"]?.editDesc || emptyStateTranslations.en.editDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <span className="material-symbols-outlined text-sm text-brand mt-0.5">splitscreen</span>
                <div>
                  <h5 className="text-xs font-semibold text-text-strong">
                    {emptyStateTranslations[language as "en" | "es"]?.diffTitle || emptyStateTranslations.en.diffTitle}
                  </h5>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {emptyStateTranslations[language as "en" | "es"]?.diffDesc || emptyStateTranslations.en.diffDesc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 text-left">
                <span className="material-symbols-outlined text-sm text-brand mt-0.5">save</span>
                <div>
                  <h5 className="text-xs font-semibold text-text-strong">
                    {emptyStateTranslations[language as "en" | "es"]?.saveTitle || emptyStateTranslations.en.saveTitle}
                  </h5>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {emptyStateTranslations[language as "en" | "es"]?.saveDesc || emptyStateTranslations.en.saveDesc}
                  </p>
                </div>
              </div>
            </div>
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
