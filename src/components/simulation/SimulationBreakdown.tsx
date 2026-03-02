'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Insight, PhasedInsights } from '@/lib/simulation/insights';

interface Props {
  insights: PhasedInsights;
  currentAge: number;
  retirementAge: number;
  lifeExpectancy: number;
}

function Section({ title, items }: { title: string; items: Insight[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-ws-text-tertiary font-medium mb-1.5">
        {title}
      </p>
      <div className="space-y-1.5">
        {items.map((insight, i) => (
          <div key={i} className="flex gap-3">
            <span className="text-xs text-ws-text-tertiary w-36 flex-shrink-0 pt-px">{insight.label}</span>
            <span className="text-sm text-ws-text">{insight.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SimulationBreakdown({ insights, currentAge, retirementAge, lifeExpectancy }: Props) {
  const [open, setOpen] = useState(false);

  const hasContent = insights.accumulation.length > 0 || insights.drawdown.length > 0 || insights.impacts.length > 0;
  if (!hasContent) return null;

  return (
    <div className="bg-ws-bg rounded-lg">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between w-full px-4 py-2.5 text-left"
      >
        <span className="text-xs font-medium text-ws-text-secondary">Assumptions breakdown</span>
        <ChevronDown
          size={14}
          className={`text-ws-text-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-4 pb-3 space-y-4">
          <Section
            title={`Accumulation (age ${currentAge} - ${retirementAge})`}
            items={insights.accumulation}
          />
          <Section
            title={`Drawdown (age ${retirementAge} - ${lifeExpectancy})`}
            items={insights.drawdown}
          />
          <Section
            title="Scenario impacts"
            items={insights.impacts}
          />
        </div>
      )}
    </div>
  );
}
