'use client';

import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';

interface ReviewConfirmFieldProps {
  label: string;
  value: string;
  editValue?: number | string;
  type?: 'number' | 'text' | 'select';
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: { value: string; label: string }[];
  insight?: string;
  onChange: (value: number | string) => void;
}

export default function ReviewConfirmField({
  label,
  value,
  editValue,
  type = 'number',
  prefix,
  suffix,
  min,
  max,
  step = 1,
  options,
  insight,
  onChange,
}: ReviewConfirmFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [edited, setEdited] = useState(false);
  const [localValue, setLocalValue] = useState(String(editValue ?? value));

  const handleEdit = () => {
    setIsEditing(true);
    setLocalValue(String(editValue ?? value));
  };

  const handleSave = () => {
    if (type === 'number') {
      const num = parseFloat(localValue);
      if (!isNaN(num)) {
        const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, num));
        onChange(clamped);
      }
    } else {
      onChange(localValue);
    }
    setIsEditing(false);
    setEdited(true);
  };

  return (
    <div className="bg-white rounded-xl border border-ws-border p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs text-ws-text-tertiary uppercase tracking-wider mb-1">{label}</p>

          {isEditing ? (
            <div className="flex items-center gap-2 mt-1">
              {type === 'select' && options ? (
                <select
                  className="text-sm border border-ws-border rounded-lg px-3 py-1.5 bg-white text-ws-text focus:outline-none focus:ring-2 focus:ring-ws-green/30"
                  value={localValue}
                  onChange={(e) => {
                    setLocalValue(e.target.value);
                    onChange(e.target.value);
                    setIsEditing(false);
                    setEdited(true);
                  }}
                  autoFocus
                >
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <>
                  {prefix && <span className="text-sm text-ws-text-secondary">{prefix}</span>}
                  <input
                    type={type}
                    className="text-sm border border-ws-border rounded-lg px-3 py-1.5 w-28 bg-white text-ws-text focus:outline-none focus:ring-2 focus:ring-ws-green/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    value={localValue}
                    min={min}
                    max={max}
                    step={step}
                    onChange={(e) => setLocalValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSave();
                      if (e.key === 'Escape') setIsEditing(false);
                    }}
                    autoFocus
                  />
                  {suffix && <span className="text-sm text-ws-text-secondary">{suffix}</span>}
                  <button
                    onClick={handleSave}
                    className="p-1.5 rounded-lg bg-ws-green text-white hover:bg-ws-green/90 transition-colors"
                  >
                    <Check size={14} />
                  </button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-lg font-semibold text-ws-text">{value}</p>
              {edited && (
                <span className="flex items-center gap-1 text-ws-green">
                  <Check size={14} />
                </span>
              )}
            </div>
          )}

          {insight && !isEditing && (
            <p className="text-xs text-ws-green mt-1.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-ws-green flex-shrink-0" />
              {insight}
            </p>
          )}
        </div>

        {!isEditing && (
          <button
            onClick={handleEdit}
            className="p-1.5 rounded-lg hover:bg-ws-hover transition-colors text-ws-text-tertiary"
          >
            <Pencil size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
