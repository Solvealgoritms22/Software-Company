"use client";

import React, { useState, KeyboardEvent } from "react";

type Props = {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
};

export function TagInput({ label, value, onChange, placeholder = "Agregar..." }: Props) {
  const [inputValue, setInputValue] = useState("");
  
  const tags = value
    .split("\n")
    .map(t => t.trim())
    .filter(Boolean);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const newTag = inputValue.trim();
      if (newTag && !tags.includes(newTag)) {
        onChange([...tags, newTag].join("\n"));
        setInputValue("");
      }
    } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag if backspace is pressed on empty input
      e.preventDefault();
      onChange(tags.slice(0, -1).join("\n"));
    }
  };

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, i) => i !== indexToRemove).join("\n"));
  };

  return (
    <div className="flex flex-col">
      {label && <span className="block text-sm font-medium text-text-strong mb-1">{label}</span>}
      <div 
        className="flex flex-wrap items-center gap-2 w-full min-h-[42px] rounded-lg border border-line bg-surface p-2 transition-colors focus-within:border-brand focus-within:ring-1 focus-within:ring-brand cursor-text"
        onClick={() => document.getElementById(`tag-input-${label || "default"}`)?.focus()}
      >
        {tags.map((tag, index) => (
          <span 
            key={index}
            className="flex items-center gap-1 bg-surface-muted text-text-strong text-xs font-semibold px-2.5 py-1 rounded-md"
          >
            {tag}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              className="text-text-muted hover:text-danger rounded-full focus:outline-none flex items-center justify-center"
            >
              <span className="material-symbols-outlined w-3 h-3">close</span>
            </button>
          </span>
        ))}
        <input
          id={`tag-input-${label || "default"}`}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="flex-1 bg-transparent text-sm text-text-strong outline-none min-w-[100px]"
        />
      </div>
      <span className="text-[10px] text-text-muted mt-1 ml-1">Presiona Enter para agregar</span>
    </div>
  );
}
