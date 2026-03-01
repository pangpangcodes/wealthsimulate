'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import type { ScenarioOverrides } from '@/lib/types/simulation';

interface AssumptionValues {
  inflationRate: number;
  retirementAge: number;
  lifeExpectancy: number;
  annualSavingsRate: number;
  desiredRetirementIncome: number;
}

interface ScenarioVariantPopoverProps {
  sourceScenarioName: string;
  baseValues: AssumptionValues;
  onRunAll: (scenarios: ScenarioOverrides[]) => void;
  onClose: () => void;
}

function autoName(base: AssumptionValues, draft: AssumptionValues): string {
  const parts: string[] = [];
  if (draft.annualSavingsRate !== base.annualSavingsRate) {
    parts.push(`Save ${Math.round(draft.annualSavingsRate * 100)}%`);
  }
  if (draft.retirementAge !== base.retirementAge) {
    parts.push(`Retire at ${draft.retirementAge}`);
  }
  if (draft.lifeExpectancy !== base.lifeExpectancy) {
    parts.push(`Life exp. ${draft.lifeExpectancy}`);
  }
  if (draft.inflationRate !== base.inflationRate) {
    parts.push(`${(draft.inflationRate * 100).toFixed(1)}% inflation`);
  }
  if (draft.desiredRetirementIncome !== base.desiredRetirementIncome) {
    parts.push(`$${draft.desiredRetirementIncome.toLocaleString()} ret. income`);
  }
  return parts.length > 0 ? parts.join(', ') : 'Custom variant';
}

function buildOverrides(base: AssumptionValues, draft: AssumptionValues): ScenarioOverrides {
  const overrides: ScenarioOverrides = {
    name: autoName(base, draft),
  };
  if (draft.inflationRate !== base.inflationRate) overrides.inflationRate = draft.inflationRate;
  if (draft.retirementAge !== base.retirementAge) overrides.retirementAge = draft.retirementAge;
  if (draft.lifeExpectancy !== base.lifeExpectancy) overrides.lifeExpectancy = draft.lifeExpectancy;
  if (draft.annualSavingsRate !== base.annualSavingsRate) overrides.annualSavingsRate = draft.annualSavingsRate;
  if (draft.desiredRetirementIncome !== base.desiredRetirementIncome) overrides.desiredRetirementIncome = draft.desiredRetirementIncome;
  return overrides;
}

export default function ScenarioVariantPopover({
  sourceScenarioName,
  baseValues,
  onRunAll,
  onClose,
}: ScenarioVariantPopoverProps) {
  const [draft, setDraft] = useState<AssumptionValues>({ ...baseValues });
  const [queue, setQueue] = useState<ScenarioOverrides[]>([]);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const hasChanges =
    draft.inflationRate !== baseValues.inflationRate ||
    draft.retirementAge !== baseValues.retirementAge ||
    draft.lifeExpectancy !== baseValues.lifeExpectancy ||
    draft.annualSavingsRate !== baseValues.annualSavingsRate ||
    draft.desiredRetirementIncome !== baseValues.desiredRetirementIncome;

  const handleAdd = useCallback(() => {
    if (!hasChanges) return;
    setQueue((q) => [...q, buildOverrides(baseValues, draft)]);
    setDraft({ ...baseValues });
  }, [draft, baseValues, hasChanges]);

  const handleRemoveFromQueue = useCallback((index: number) => {
    setQueue((q) => q.filter((_, i) => i !== index));
  }, []);

  const handleRunAll = useCallback(() => {
    // If there are unsaved changes in the form, include them too
    const all = [...queue];
    if (hasChanges) {
      all.push(buildOverrides(baseValues, draft));
    }
    if (all.length > 0) {
      onRunAll(all);
    }
  }, [queue, draft, baseValues, hasChanges, onRunAll]);

  const totalToRun = queue.length + (hasChanges ? 1 : 0);

  return (
    <div
      ref={popoverRef}
      className="mt-2 bg-white rounded-xl border border-ws-border shadow-lg p-4 relative z-10"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      role="dialog"
      aria-label={`Create variant from ${sourceScenarioName}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium text-ws-text">
          Create variant from {sourceScenarioName}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 rounded hover:bg-ws-border/50 transition-colors"
          aria-label="Close"
        >
          <X size={12} className="text-ws-text-tertiary" />
        </button>
      </div>

      {/* Queued variants */}
      {queue.length > 0 && (
        <div className="mb-3 space-y-1">
          {queue.map((item, i) => (
            <div key={i} className="flex items-center justify-between bg-ws-bg rounded-md px-2.5 py-1.5">
              <span className="text-[11px] text-ws-text-secondary">{item.name}</span>
              <button
                type="button"
                onClick={() => handleRemoveFromQueue(i)}
                className="p-0.5 rounded hover:bg-ws-border/50 transition-colors"
              >
                <X size={10} className="text-ws-text-tertiary" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Editable assumption fields */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <FieldInput
          label="Inflation"
          value={parseFloat((draft.inflationRate * 100).toFixed(1))}
          suffix="%"
          min={0}
          max={15}
          step={0.1}
          changed={draft.inflationRate !== baseValues.inflationRate}
          onChange={(v) => setDraft((d) => ({ ...d, inflationRate: v / 100 }))}
        />
        <FieldInput
          label="Ret. age"
          value={draft.retirementAge}
          min={40}
          max={80}
          step={1}
          changed={draft.retirementAge !== baseValues.retirementAge}
          onChange={(v) => setDraft((d) => ({ ...d, retirementAge: Math.round(v) }))}
        />
        <FieldInput
          label="Life exp."
          value={draft.lifeExpectancy}
          min={65}
          max={110}
          step={1}
          changed={draft.lifeExpectancy !== baseValues.lifeExpectancy}
          onChange={(v) => setDraft((d) => ({ ...d, lifeExpectancy: Math.round(v) }))}
        />
        <FieldInput
          label="Savings"
          value={parseFloat((draft.annualSavingsRate * 100).toFixed(0))}
          suffix="%"
          min={0}
          max={80}
          step={1}
          changed={draft.annualSavingsRate !== baseValues.annualSavingsRate}
          onChange={(v) => setDraft((d) => ({ ...d, annualSavingsRate: v / 100 }))}
        />
        <FieldInput
          label="Ret. income"
          value={Math.round(draft.desiredRetirementIncome)}
          prefix="$"
          min={0}
          max={500000}
          step={1000}
          changed={draft.desiredRetirementIncome !== baseValues.desiredRetirementIncome}
          onChange={(v) => setDraft((d) => ({ ...d, desiredRetirementIncome: v }))}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-ws-text-secondary hover:text-ws-text px-3 py-1.5 rounded-md transition-colors"
        >
          Cancel
        </button>
        {/* Add to queue (only if there are changes and user wants to batch) */}
        <button
          type="button"
          onClick={handleAdd}
          disabled={!hasChanges}
          className="text-xs font-medium text-ws-text border border-ws-border hover:bg-ws-bg disabled:text-ws-text-tertiary disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-colors"
        >
          Add
        </button>
        <button
          type="button"
          onClick={handleRunAll}
          disabled={totalToRun === 0}
          className="text-xs font-medium text-white bg-ws-black hover:bg-ws-black/90 disabled:bg-ws-text-tertiary disabled:cursor-not-allowed px-3 py-1.5 rounded-md transition-colors"
        >
          Run{totalToRun > 1 ? ` (${totalToRun})` : ''}
        </button>
      </div>
    </div>
  );
}

// ── Small inline input for assumption fields ─────────────────────────────────

function FieldInput({
  label,
  value,
  prefix,
  suffix,
  min,
  max,
  step = 1,
  changed,
  onChange,
}: {
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  min: number;
  max: number;
  step?: number;
  changed: boolean;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  // Sync draft when value changes from parent
  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = () => {
    const parsed = parseFloat(draft);
    if (!isNaN(parsed) && parsed >= min && parsed <= max) {
      onChange(parsed);
    } else {
      setDraft(String(value));
    }
  };

  return (
    <div>
      <p className="text-[10px] text-ws-text-tertiary uppercase tracking-wider mb-0.5 truncate">
        {label}
      </p>
      <div className="flex items-center gap-0.5">
        {prefix && <span className="text-[10px] text-ws-text-tertiary">{prefix}</span>}
        <input
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
          min={min}
          max={max}
          step={step}
          className={`w-full text-xs font-medium bg-ws-bg border rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ws-black/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${
            changed ? 'border-ws-green text-ws-green' : 'border-ws-border text-ws-text'
          }`}
        />
        {suffix && <span className="text-[10px] text-ws-text-tertiary">{suffix}</span>}
      </div>
    </div>
  );
}
