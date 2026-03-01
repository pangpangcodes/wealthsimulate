'use client';

import { useMemo } from 'react';
import type { SensitivityResult, SensitivityVariable } from '@/lib/simulation/sensitivity';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** True when the variable's impact is large enough to display */
function isSignificant(v: SensitivityVariable): boolean {
  if (v.metric === 'Money Lasts To') return v.maxAbsDelta >= 0.5;
  if (v.metric === 'Income Replacement') return v.maxAbsDelta >= 0.005;
  return v.maxAbsDelta >= 500;
}

/** Convert perturbation string into natural "If X higher/lower" labels */
function perturbLabels(v: SensitivityVariable): { low: string; high: string } {
  const match = v.perturbation.match(/\+\/- (\d+)/);
  const n = match ? match[1] : '?';

  if (v.perturbation.includes('year')) {
    if (v.name === 'retirement_age') {
      return { low: `If ${n} years earlier`, high: `If ${n} years later` };
    }
    return { low: `If ${n} years shorter`, high: `If ${n} years longer` };
  }
  return { low: `If ${n}% lower`, high: `If ${n}% higher` };
}

/** Format a delta value as plain English */
function fmtImpact(delta: number, metric: string): string {
  if (metric === 'Money Lasts To') {
    const years = Math.abs(delta);
    if (years < 0.5) return 'no change';
    const rounded = Math.round(years);
    const yearWord = rounded === 1 ? 'year' : 'years';
    if (delta > 0) return `money lasts ${rounded} ${yearWord} longer`;
    return `money runs out ${rounded} ${yearWord} sooner`;
  }

  if (metric === 'Income Replacement') {
    const pct = Math.abs(delta * 100);
    if (pct < 0.5) return 'no change';
    const sign = delta >= 0 ? '+' : '-';
    return `${sign}${Math.round(pct)}% income replacement`;
  }

  // Dollar metrics (Net Worth at Retirement, Retirement Income)
  const abs = Math.abs(delta);
  if (abs < 500) return 'no change';
  const sign = delta >= 0 ? '+' : '-';
  let formatted: string;
  if (abs >= 1_000_000) formatted = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) formatted = `$${(abs / 1_000).toFixed(0)}K`;
  else formatted = `$${abs.toFixed(0)}`;
  return `${sign}${formatted} at retirement`;
}

/** Colour class for a delta value */
function deltaColour(delta: number, metric: string): string {
  if (metric === 'Money Lasts To' && Math.abs(delta) < 0.5) return 'text-ws-text-tertiary';
  if (metric === 'Income Replacement' && Math.abs(delta * 100) < 0.5) return 'text-ws-text-tertiary';
  if (metric !== 'Money Lasts To' && metric !== 'Income Replacement' && Math.abs(delta) < 500)
    return 'text-ws-text-tertiary';

  return delta >= 0 ? 'text-ws-green' : 'text-ws-red';
}

// ─── Component ──────────────────────────────────────────────────────────────

interface SensitivityChartProps {
  result: SensitivityResult;
}

export default function SensitivityChart({ result }: SensitivityChartProps) {
  const meaningful = useMemo(
    () => result.variables.filter(isSignificant),
    [result.variables]
  );

  // Don't render anything if no variables have meaningful impact
  if (meaningful.length === 0) return null;

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-ws-text-tertiary">
          What moves the needle
        </h3>
        <p className="mt-0.5 text-[10px] text-ws-text-tertiary">
          We tweaked each variable to see which ones matter most.
        </p>
      </div>

      <div className="space-y-2">
          {meaningful.map((v) => {
            const labels = perturbLabels(v);
            return (
              <div key={v.name} className="rounded-lg bg-ws-bg px-3 py-2.5">
                <p className="text-xs font-medium text-ws-text">{v.label}</p>
                <div className="mt-1.5 space-y-0.5">
                  <p className="text-xs">
                    <span className="text-ws-text-tertiary">{labels.high}</span>
                    <span className="text-ws-text-tertiary mx-1.5">{'\u2192'}</span>
                    <span className={deltaColour(v.highDelta, v.metric)}>
                      {fmtImpact(v.highDelta, v.metric)}
                    </span>
                  </p>
                  <p className="text-xs">
                    <span className="text-ws-text-tertiary">{labels.low}</span>
                    <span className="text-ws-text-tertiary mx-1.5">{'\u2192'}</span>
                    <span className={deltaColour(v.lowDelta, v.metric)}>
                      {fmtImpact(v.lowDelta, v.metric)}
                    </span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
    </div>
  );
}
