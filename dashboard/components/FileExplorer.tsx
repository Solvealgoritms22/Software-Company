"use client";

import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronDown, Folder, File, FileCode, FileText, Image as ImageIcon, FileJson, FileCog } from "lucide-react";
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
  data: FileNode;
  onFileSelect?: (path: string) => void;
};

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  
  if (['ts', 'tsx', 'js', 'jsx', 'py'].includes(ext || '')) return <FileCode className="w-4 h-4 text-brand" />;
  if (['json', 'yaml', 'yml', 'toml'].includes(ext || '')) return <FileJson className="w-4 h-4 text-[#e8a317]" />;
  if (['md', 'txt'].includes(ext || '')) return <FileText className="w-4 h-4 text-text-muted" />;
  if (['png', 'jpg', 'jpeg', 'svg', 'gif'].includes(ext || '')) return <ImageIcon className="w-4 h-4 text-purple-400" />;
  if (['env', 'gitignore'].includes(ext || '') || name.startsWith('.')) return <FileCog className="w-4 h-4 text-text-muted opacity-80" />;
  
  return <File className="w-4 h-4 text-text-muted" />;
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
            isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
          ) : (
            <span className="w-4 h-4" /> // spacing for alignment
          )}
        </div>
        
        <div className="flex items-center justify-center">
          {isDir ? (
            <Folder className={cn("w-4 h-4", isExpanded ? "text-brand" : "text-text-muted")} />
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

export function FileExplorer({ data, onFileSelect }: Props) {
  if (!data) return null;

  return (
    <div className="flex flex-col h-full bg-surface border border-line overflow-hidden font-mono shadow-sm">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface-muted">
        <div className="text-xs font-semibold text-text-strong uppercase tracking-wider border-b-2 border-brand pb-[1px]">Files</div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scroll-mask-y text-text-strong">
        {data.children && data.children.map(child => (
          <TreeNode key={child.path} node={child} depth={0} onFileSelect={onFileSelect} />
        ))}
      </div>
    </div>
  );
}
