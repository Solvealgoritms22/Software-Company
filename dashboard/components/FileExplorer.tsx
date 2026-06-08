"use client";

import React, { useState } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

type FileNode = {
  name: string;
  type: "dir" | "file";
  path: string;
  children?: FileNode[];
};

type Props = {
  data: FileNode | null | undefined;
  onFileSelect?: (path: string) => void;
  language?: string;
};

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  
  if (['ts', 'tsx', 'js', 'jsx', 'py'].includes(ext || '')) {
    return <span className="material-symbols-outlined w-4 h-4 text-brand">code</span>;
  }
  if (['json', 'yaml', 'yml', 'toml'].includes(ext || '')) {
    return <span className="material-symbols-outlined w-4 h-4 text-[#e8a317]">data_object</span>;
  }
  if (['md', 'txt'].includes(ext || '')) {
    return <span className="material-symbols-outlined w-4 h-4 text-text-muted">description</span>;
  }
  if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext || '')) {
    return <span className="material-symbols-outlined w-4 h-4 text-purple-400">image</span>;
  }
  if (['env', 'gitignore'].includes(ext || '') || name.startsWith('.')) {
    return <span className="material-symbols-outlined w-4 h-4 text-text-muted opacity-80">settings_applications</span>;
  }
  
  return <span className="material-symbols-outlined w-4 h-4 text-text-muted">draft</span>;
};

const TreeNode = ({ node, depth = 0, onFileSelect }: { node: FileNode; depth?: number; onFileSelect?: (path: string) => void }) => {
  const isDir = node.type === "dir";
  const defaultExpanded = depth === 0;

  const [isExpanded, setIsExpanded] = useState(() => {
    if (typeof window === "undefined" || !isDir) return defaultExpanded;
    const key = `explorer_expanded_${node.path || node.name}`;
    const stored = localStorage.getItem(key);
    return stored !== null ? stored === 'true' : defaultExpanded;
  });

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDir) {
      const next = !isExpanded;
      setIsExpanded(next);
      if (typeof window !== "undefined") {
        localStorage.setItem(`explorer_expanded_${node.path || node.name}`, next.toString());
      }
    } else if (onFileSelect) {
      onFileSelect(node.path);
    }
  };

  return (
    <div className="flex flex-col select-none">
      <div 
        className={cn(
          "flex items-center gap-1.5 py-1 px-2 hover:bg-surface-muted rounded-md cursor-pointer transition-colors text-sm",
          !isDir && "hover:text-brand"
        )}
        style={{ paddingLeft: `${depth * 1.2 + 0.5}rem` }}
        onClick={handleToggle}
      >
        <div className="flex items-center justify-center w-4 h-4 text-text-muted">
          {isDir ? (
            isExpanded ? (
              <span className="material-symbols-outlined w-4 h-4">keyboard_arrow_down</span>
            ) : (
              <span className="material-symbols-outlined w-4 h-4">chevron_right</span>
            )
          ) : (
            <span className="w-4 h-4" /> // spacing for alignment
          )}
        </div>
        
        <div className="flex items-center justify-center">
          {isDir ? (
            <span 
              className={cn("material-symbols-outlined w-4 h-4 hover-fill", isExpanded ? "text-brand active-fill" : "text-text-muted")}
            >
              folder
            </span>
          ) : (
            getFileIcon(node.name)
          )}
        </div>
        
        <span className={cn("truncate", isDir ? "font-medium text-text-strong" : "text-text-muted")}>
          {node.name}
        </span>
      </div>

      {isDir && isExpanded && node.children && (
        <div className="flex flex-col">
          {node.children.map((child) => (
            <TreeNode key={child.path || child.name} node={child} depth={depth + 1} onFileSelect={onFileSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

export function FileExplorer({ data, onFileSelect, language = "en" }: Props) {
  const translations = {
    en: {
      title: "Files",
      noProjects: "No active projects",
      createProject: "Create a project in the Factory tab to start.",
    },
    es: {
      title: "Archivos",
      noProjects: "Sin proyectos asociados",
      createProject: "Crea un proyecto en la pestaña Fábrica para comenzar.",
    }
  };

  const t = translations[language as "en" | "es"] || translations.en;
  const isEmpty = !data || !data.children || data.children.length === 0;

  return (
    <div className="flex flex-col h-full bg-surface overflow-hidden font-mono">
      <div className="flex items-center gap-2 px-4 border-b border-line bg-surface-muted h-[56px] flex-shrink-0">
        <div className="text-xs font-semibold text-text-strong uppercase tracking-wider border-b-2 border-brand pb-[1px]">
          {t.title}
        </div>
      </div>
      <div className={cn("flex-1 overflow-y-auto p-2 scroll-mask-y text-text-strong", isEmpty && "flex flex-col justify-center items-center")}>
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center text-text-muted text-xs">
            <span className="material-symbols-outlined text-3xl text-text-muted opacity-40 mb-3">folder_open</span>
            <p className="font-semibold text-text-strong">{t.noProjects}</p>
            <p className="mt-1 text-[10px] opacity-70 leading-relaxed max-w-[200px]">{t.createProject}</p>
          </div>
        ) : (
          <div className="w-full">
            {data!.children!.map(child => (
              <TreeNode key={child.path} node={child} depth={0} onFileSelect={onFileSelect} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
