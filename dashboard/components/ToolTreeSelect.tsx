"use client";

import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export type TreeNode = {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  children?: TreeNode[];
};

type Props = {
  nodes: TreeNode[];
  selectedIds: string[];
  onChange: (selected: string[]) => void;
  title?: string;
};

export function ToolTreeSelect({ nodes, selectedIds, onChange, title = "Configure Tools" }: Props) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(nodes.map(n => n.id))); // expand roots by default

  const toggleExpand = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpanded(next);
  };

  const handleSelect = (id: string, isChecked: boolean, nodeChildren?: TreeNode[]) => {
    let next = new Set(selectedIds);
    
    const toggleNode = (nodeId: string, check: boolean) => {
      if (check) next.add(nodeId);
      else next.delete(nodeId);
    };

    toggleNode(id, isChecked);

    // If it has children, select/deselect all children
    if (nodeChildren) {
      const traverse = (children: TreeNode[]) => {
        for (const child of children) {
          toggleNode(child.id, isChecked);
          if (child.children) traverse(child.children);
        }
      };
      traverse(nodeChildren);
    }
    
    onChange(Array.from(next));
  };

  const renderNode = (node: TreeNode, depth: number = 0) => {
    const isLeaf = !node.children || node.children.length === 0;
    const isExpanded = expanded.has(node.id);
    const isChecked = selectedIds.includes(node.id);
    
    // Check if matches query
    const matchQuery = node.label.toLowerCase().includes(query.toLowerCase()) || 
                      (node.description && node.description.toLowerCase().includes(query.toLowerCase()));
    
    // If it has children, check if any child matches
    let hasMatchingChild = false;
    if (node.children) {
      const checkMatch = (children: TreeNode[]): boolean => {
        return children.some(c => 
          c.label.toLowerCase().includes(query.toLowerCase()) || 
          (c.description && c.description.toLowerCase().includes(query.toLowerCase())) ||
          (c.children && checkMatch(c.children))
        );
      };
      hasMatchingChild = checkMatch(node.children);
    }

    if (query && !matchQuery && !hasMatchingChild) {
      return null;
    }

    return (
      <div key={node.id} className="flex flex-col">
        <div 
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 hover:bg-surface-muted rounded-md cursor-pointer transition-colors",
            depth === 0 ? "bg-surface-muted/50 mb-0.5" : ""
          )}
          style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
          onClick={(e) => {
            // If it's a leaf, toggle checkbox, otherwise toggle expand
            if (isLeaf) {
              handleSelect(node.id, !isChecked, node.children);
            } else {
              toggleExpand(node.id);
            }
          }}
        >
          <div 
            className="flex items-center justify-center w-4 h-4 text-text-muted hover:text-text-strong"
            onClick={(e) => {
              if (!isLeaf) {
                e.stopPropagation();
                toggleExpand(node.id);
              }
            }}
          >
            {!isLeaf && (isExpanded ? (
              <span className="material-symbols-outlined w-4 h-4">keyboard_arrow_down</span>
            ) : (
              <span className="material-symbols-outlined w-4 h-4">chevron_right</span>
            ))}
          </div>
          
          <div 
            className="flex items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <input 
              type="checkbox" 
              checked={isChecked}
              onChange={(e) => handleSelect(node.id, e.target.checked, node.children)}
              className="w-3.5 h-3.5 rounded border-line text-brand focus:ring-brand bg-surface cursor-pointer"
            />
          </div>

          {node.icon && <div className="text-text-muted flex items-center">{node.icon}</div>}
          
          <div className="flex items-baseline gap-2 overflow-hidden whitespace-nowrap">
            <span className={cn("text-sm font-medium", depth === 0 ? "text-text-strong" : "text-text-strong")}>
              {node.label}
            </span>
            {node.description && (
              <span className="text-xs text-text-muted truncate hidden sm:inline-block">
                {node.description}
              </span>
            )}
          </div>
        </div>

        {isExpanded && node.children && (
          <div className="flex flex-col">
            {node.children.map(child => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col border border-line rounded-lg bg-surface shadow-sm overflow-hidden w-full">
      <div className="flex items-center justify-between p-3 border-b border-line bg-surface-muted/30">
        <h3 className="text-sm font-semibold text-text-strong">{title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-brand/10 text-brand px-2 py-0.5 rounded-full">
            {selectedIds.length} Seleccionados
          </span>
        </div>
      </div>
      
      <div className="p-2 border-b border-line">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted">search</span>
          <input
            type="text"
            placeholder="Buscar tools..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-surface-muted rounded-md text-sm border-transparent focus:border-brand focus:ring-1 focus:ring-brand outline-none transition-all"
          />
        </div>
      </div>
      
      <div className="p-2 max-h-64 overflow-y-auto">
        <div className="text-xs text-text-muted mb-2 px-2">
          Selecciona las herramientas disponibles para este agente.
        </div>
        <div className="flex flex-col space-y-0.5">
          {nodes.map(node => renderNode(node, 0))}
          {nodes.length === 0 && (
            <div className="p-4 text-center text-xs text-text-muted">No hay herramientas disponibles.</div>
          )}
        </div>
      </div>
    </div>
  );
}
