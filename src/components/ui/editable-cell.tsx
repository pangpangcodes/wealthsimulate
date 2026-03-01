'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Pencil, Check } from 'lucide-react';

// ── Editable number cell ────────────────────────────────────────────────────

interface EditableCellProps {
  label: string;
  value: number;
  displayValue: string;
  suffix?: string;
  prefix?: string;
  min: number;
  max: number;
  step?: number;
  inputWidth?: string;
  onChange: (v: number) => void;
}

export function EditableCell({ label, value, displayValue, suffix, prefix, min, max, step = 1, inputWidth = 'w-20', onChange }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, value]);

  const commit = useCallback(() => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    }
    setEditing(false);
  }, [draft, min, max, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="group">
      <p className="text-[10px] text-ws-text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1">
          {prefix && <span className="text-xs text-ws-text-tertiary">{prefix}</span>}
          <input
            ref={inputRef}
            type="number"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={handleKeyDown}
            min={min}
            max={max}
            step={step}
            className={`${inputWidth} text-sm font-medium text-ws-text bg-ws-bg border border-ws-border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ws-black/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
          {suffix && <span className="text-xs text-ws-text-tertiary">{suffix}</span>}
          <button
            onClick={commit}
            className="p-0.5 rounded text-ws-green hover:bg-ws-green/10 transition-colors"
          >
            <Check size={12} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-ws-text hover:text-ws-green transition-colors cursor-pointer"
        >
          <span>{displayValue}</span>
          <Pencil size={10} className="text-ws-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
}

// ── Editable select cell ────────────────────────────────────────────────────

interface EditableSelectCellProps {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}

export function EditableSelectCell({ label, value, options, onChange }: EditableSelectCellProps) {
  const [editing, setEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => selectRef.current?.focus());
    }
  }, [editing]);

  const commit = useCallback((v: string) => {
    onChange(v);
    setEditing(false);
  }, [onChange]);

  const displayLabel = options.find((o) => o.value === value)?.label ?? value;

  return (
    <div className="group">
      <p className="text-[10px] text-ws-text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
      {editing ? (
        <div className="flex items-center gap-1">
          <select
            ref={selectRef}
            value={value}
            onChange={(e) => commit(e.target.value)}
            onBlur={() => setEditing(false)}
            className="text-sm font-medium text-ws-text bg-ws-bg border border-ws-border rounded-md px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ws-black/20"
          >
            {options.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex items-center gap-1.5 text-sm font-medium text-ws-text hover:text-ws-green transition-colors cursor-pointer"
        >
          <span>{displayLabel}</span>
          <Pencil size={10} className="text-ws-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      )}
    </div>
  );
}

// ── Static cell (non-editable) ──────────────────────────────────────────────

export function StaticCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-ws-text-tertiary uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-ws-text">{value}</p>
    </div>
  );
}
