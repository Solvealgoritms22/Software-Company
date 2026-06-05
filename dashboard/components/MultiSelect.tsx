"use client";

import React, { useState, useRef, useEffect } from "react";

export type MultiSelectOption = {
  value: string;
  label: string;
};

type Props = {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
};

export function MultiSelect({ options, selected, onChange, placeholder = "Seleccionar..." }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const toggleOption = (val: string) => {
    if (selected.includes(val)) {
      onChange(selected.filter((v) => v !== val));
    } else {
      onChange([...selected, val]);
    }
    setQuery("");
  };

  const removeOption = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onChange(selected.filter((v) => v !== val));
  };

  const filteredOptions = options.filter(o => o.label.toLowerCase().includes(query.toLowerCase()) || o.value.toLowerCase().includes(query.toLowerCase()));
  
  // Add creatable option if query is not empty and doesn't exactly match an existing option
  const exactMatch = options.some(o => o.value.toLowerCase() === query.trim().toLowerCase());
  const creatable = query.trim() !== "" && !exactMatch;

  return (
    <div className="relative w-full text-left" ref={ref}>
      <div 
        className="min-h-[46px] w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-text-strong cursor-text flex flex-wrap gap-2 items-center transition-all focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 shadow-sm"
        onClick={() => setOpen(true)}
      >
        {selected.map(val => {
          const opt = options.find(o => o.value === val);
          return (
            <span 
              key={val} 
              className="group flex items-center gap-1.5 bg-surface-muted border border-line/60 hover:border-brand/40 text-text-strong px-2.5 py-1 rounded-md text-xs font-medium transition-all"
            >
              <span className="max-w-[150px] truncate">{opt ? opt.label : val}</span>
              <button 
                type="button" 
                onClick={(e) => removeOption(e, val)} 
                className="text-text-muted hover:text-red-500 hover:bg-red-500/10 rounded-sm p-0.5 transition-colors focus:outline-none flex items-center justify-center"
              >
                <span className="material-symbols-outlined w-3.5 h-3.5">close</span>
              </button>
            </span>
          );
        })}
        
        <input 
          type="text" 
          className="flex-1 min-w-[120px] bg-transparent outline-none text-text-strong text-sm placeholder:text-text-muted/60"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? placeholder : "Escribe para buscar o añadir..."}
          onKeyDown={(e) => {
            if (e.key === "Enter" && creatable) {
              e.preventDefault();
              toggleOption(query.trim());
            }
          }}
        />
        
        <div className="ml-auto flex items-center gap-2 pl-2 border-l border-line/40">
          <span 
            className={`material-symbols-outlined w-4 h-4 text-text-muted cursor-pointer transition-transform duration-200 ${open ? 'rotate-180' : ''}`} 
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
          >
            expand_more
          </span>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 mt-2 w-full rounded-xl border border-line bg-surface shadow-2xl max-h-64 overflow-y-auto p-1.5 animate-in fade-in slide-in-from-top-2 duration-200">
          {filteredOptions.length === 0 && !creatable ? (
            <div className="px-3 py-2 text-sm text-text-muted text-center">No hay resultados</div>
          ) : (
            <>
              {filteredOptions.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    className={`flex items-center justify-between px-3 py-2 text-sm rounded-md cursor-pointer transition-colors ${
                      isSelected ? "bg-brand/10 text-brand" : "text-text-strong hover:bg-surface-muted"
                    }`}
                    onClick={() => toggleOption(opt.value)}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <span className="material-symbols-outlined w-4 h-4 text-brand">check</span>}
                  </div>
                );
              })}
              {creatable && (
                <div
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-md cursor-pointer transition-colors text-brand hover:bg-brand/10 border-t border-line/50 mt-1 pt-2"
                  onClick={() => toggleOption(query.trim())}
                >
                  <span className="material-symbols-outlined w-4 h-4">add</span>
                  <span>Añadir "{query.trim()}"</span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
