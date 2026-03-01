'use client';

import { useCallback } from 'react';
import { useProfileStore } from '@/lib/store/profile-store';
import { EditableCell, StaticCell } from '@/components/ui/editable-cell';
import { motion } from 'framer-motion';

// ── Main component ──────────────────────────────────────────────────────────

interface ModelAssumptionsProps {
  onChanged?: () => void;
}

export default function ModelAssumptions({ onChanged }: ModelAssumptionsProps) {
  const profile = useProfileStore((s) => s.profile);
  const updateField = useProfileStore((s) => s.updateField);

  const handleChange = useCallback(
    <K extends keyof typeof profile>(field: K, value: (typeof profile)[K]) => {
      updateField(field, value);
      onChanged?.();
    },
    [updateField, onChanged]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border border-ws-border p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-ws-text">Model Assumptions</h3>
        <span className="text-[9px] text-ws-text-tertiary bg-ws-bg px-2 py-1 rounded">
          Click to edit
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-3">
        <EditableCell
          label="Inflation"
          value={parseFloat((profile.inflationRate * 100).toFixed(1))}
          displayValue={`${(profile.inflationRate * 100).toFixed(1)}%`}
          suffix="%"
          min={0}
          max={15}
          step={0.1}
          onChange={(v) => handleChange('inflationRate', v / 100)}
        />
        <EditableCell
          label="Retirement age"
          value={profile.retirementAge}
          displayValue={String(profile.retirementAge)}
          min={40}
          max={80}
          onChange={(v) => handleChange('retirementAge', Math.round(v))}
        />
        <EditableCell
          label="Life expectancy"
          value={profile.lifeExpectancy}
          displayValue={String(profile.lifeExpectancy)}
          min={65}
          max={110}
          onChange={(v) => handleChange('lifeExpectancy', Math.round(v))}
        />
        <EditableCell
          label="Savings rate"
          value={parseFloat((profile.annualSavingsRate * 100).toFixed(0))}
          displayValue={`${(profile.annualSavingsRate * 100).toFixed(0)}%`}
          suffix="%"
          min={0}
          max={80}
          step={1}
          onChange={(v) => handleChange('annualSavingsRate', v / 100)}
        />
        <EditableCell
          label="Retirement income"
          value={profile.desiredRetirementIncome ?? profile.monthlyExpenses * 12}
          displayValue={`$${((profile.desiredRetirementIncome ?? profile.monthlyExpenses * 12) / 1000).toFixed(0)}K/yr`}
          prefix="$"
          suffix="/yr"
          min={0}
          max={500000}
          step={1000}
          inputWidth="w-24"
          onChange={(v) => handleChange('desiredRetirementIncome', Math.round(v))}
        />
        <StaticCell label="Futures simulated" value="1,000" />
      </div>

      <div className="mt-4 pt-4 border-t border-ws-border space-y-2">
        <p className="text-[11px] text-ws-text-tertiary leading-relaxed">
          <strong className="text-ws-text-secondary">Retirement income</strong> is how much you want to spend each year in retirement (today's dollars). Government pensions (CPP/OAS) count toward this target.
        </p>
        <p className="text-[11px] text-ws-text-tertiary leading-relaxed">
          Each future is simulated year by year - your investments grow (or shrink)
          based on realistic market patterns, you pay simplified Canadian taxes, and contribute
          to RRSP/TFSA. CPP/OAS government pensions offset withdrawals in retirement, and
          RRSP withdrawals are taxed as income. These are simulated scenarios, not predictions of what will happen.
        </p>
      </div>
    </motion.div>
  );
}
