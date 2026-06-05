"use client";

import React, { useEffect, useRef, useState, ReactNode } from "react";

export type MenuSelectOption = {
  value: string;
  label: ReactNode;
  iconUrl?: string;
  iconNode?: ReactNode;
  invertDark?: boolean;
  disabled?: boolean;
};

type Props = {
  options: MenuSelectOption[];
  value?: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  className?: string;
  disabled?: boolean;
};

export function MenuSelect({
  options,
  value,
  placeholder = "Selecciona...",
  onChange,
  className = "",
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((o) => o.value === value);
      setHighlight(idx >= 0 ? idx : 0);
    } else {
      setHighlight(null);
    }
  }, [open, value, options]);

  function toggle() {
    if (!disabled) {
      setOpen((v) => !v);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((prev) => {
        return prev === null ? 0 : Math.min(options.length - 1, prev + 1);
      });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((prev) => {
        return prev === null ? options.length - 1 : Math.max(0, prev - 1);
      });
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open && highlight !== null) {
        const opt = options[highlight];
        if (!opt.disabled && onChange) onChange(opt.value);
        setOpen(false);
      } else {
        setOpen(true);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      <button
        type="button"
        className={`w-full flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-brand/50 shadow-sm
          ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-[var(--line-strong)] text-text-strong"}
        `}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={handleKeyDown}
        disabled={disabled}
      >
        <div className="flex items-center gap-2 truncate">
          {selected?.iconNode ? (
            <div className="w-5 h-5 flex items-center justify-center flex-shrink-0 text-text-muted">{selected.iconNode}</div>
          ) : selected?.iconUrl ? (
            <img src={selected.iconUrl} alt="" className={`w-5 h-5 object-contain flex-shrink-0 ${selected.invertDark ? 'dark:invert' : ''}`} />
          ) : null}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </div>
        <span className="material-symbols-outlined w-4 h-4 text-text-muted flex-shrink-0">expand_more</span>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          onKeyDown={handleKeyDown}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-line bg-surface dark:bg-[#151516] py-1 shadow-xl focus:outline-none"
        >
          {options.map((opt, idx) => {
            const isSelected = value === opt.value;
            const isHighlighted = highlight === idx;

            return (
              <li
                role="option"
                aria-selected={isSelected}
                key={opt.value}
                onClick={() => {
                  if (!opt.disabled && onChange) onChange(opt.value);
                  setOpen(false);
                }}
                onMouseEnter={() => setHighlight(idx)}
                className={`relative flex items-center gap-2 px-3 py-2 text-sm cursor-pointer select-none
                  ${opt.disabled ? "opacity-50 cursor-not-allowed" : ""}
                  ${isHighlighted ? "bg-surface-muted" : ""}
                  ${isSelected ? "text-brand font-medium" : "text-text-strong"}
                `}
              >
                {opt.iconNode ? (
                  <div className={`w-5 h-5 flex items-center justify-center flex-shrink-0 ${isSelected ? "text-brand" : "text-text-muted"}`}>{opt.iconNode}</div>
                ) : opt.iconUrl ? (
                  <img src={opt.iconUrl} alt="" className={`w-5 h-5 object-contain flex-shrink-0 ${opt.invertDark ? 'dark:invert' : ''}`} />
                ) : (
                  <div className="w-5 h-5 flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{opt.label}</span>
                {isSelected && <span className="material-symbols-outlined w-4 h-4 text-brand flex-shrink-0">check</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
