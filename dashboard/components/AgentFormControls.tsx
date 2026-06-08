import { ReactNode, useState } from "react";
import { MaterialIcon } from "./MaterialIcon";
import { listToText, textToList } from "./agentSettingsData";

export function Field({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; icon?: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <input className="mt-2 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong outline-none transition focus:border-brand" value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function Area({ label, value, onChange, placeholder, icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; icon?: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-text-strong">
      <span className="flex items-center gap-2">{icon}{label}</span>
      <textarea className="mt-2 min-h-80 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-strong leading-6 outline-none transition focus:border-brand" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </label>
  );
}

export function TagInput({ placeholder, value, onChange, className }: { placeholder?: string; value: string; onChange: (val: string) => void; className?: string }) {
  const tags = textToList(value);
  const [inputValue, setInputValue] = useState("");

  function addTag(tag: string) {
    const normalized = tag.trim();
    if (normalized && !tags.includes(normalized)) onChange(listToText([...tags, normalized]));
  }

  function removeTag(tag: string) {
    onChange(listToText(tags.filter((item) => item !== tag)));
  }

  return (
    <div className={`flex flex-wrap items-start gap-1.5 p-2 cursor-text ${className}`} onClick={(event) => event.currentTarget.querySelector("input")?.focus()}>
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded bg-surface-muted border border-line px-2 py-1 text-xs font-medium text-text-strong">
          {tag}
          <button type="button" onClick={() => removeTag(tag)} className="text-text-muted hover:text-danger">
            <MaterialIcon name="close" className="w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        className="flex-1 min-w-[80px] bg-transparent text-xs text-text-strong outline-none placeholder:text-text-muted mt-0.5"
        placeholder={tags.length === 0 ? placeholder : ""}
        value={inputValue}
        onChange={(event) => setInputValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === ",") {
            event.preventDefault();
            addTag(inputValue);
            setInputValue("");
          } else if (event.key === "Backspace" && inputValue === "" && tags.length > 0) {
            removeTag(tags[tags.length - 1]);
          }
        }}
        onBlur={() => {
          if (!inputValue) return;
          addTag(inputValue);
          setInputValue("");
        }}
      />
    </div>
  );
}
