'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useProfileStore } from '@/lib/store/profile-store';
import ReviewConfirmField from './ReviewConfirmField';

interface ReviewStepRiskProps {
  onComplete: () => void;
  onBack: () => void;
}

export default function ReviewStepRisk({ onComplete, onBack }: ReviewStepRiskProps) {
  const profile = useProfileStore((s) => s.profile);
  const updateField = useProfileStore((s) => s.updateField);
  const getAllocationSummary = useProfileStore((s) => s.getAllocationSummary);
  const getInvestmentAccounts = useProfileStore((s) => s.getInvestmentAccounts);

  const allocation = useMemo(() => getAllocationSummary(), [getAllocationSummary]);
  const investmentAccounts = useMemo(() => getInvestmentAccounts(), [getInvestmentAccounts]);

  const equityPct = useMemo(() => {
    const equityClasses = ['canadian-equity', 'us-equity', 'international-equity', 'emerging-markets'];
    return allocation
      .filter((a) => equityClasses.includes(a.assetClass))
      .reduce((sum, a) => sum + a.percentage, 0);
  }, [allocation]);

  const bondPct = useMemo(() => {
    const bondClasses = ['canadian-bonds', 'international-bonds', 'high-yield-bonds'];
    return allocation
      .filter((a) => bondClasses.includes(a.assetClass))
      .reduce((sum, a) => sum + a.percentage, 0);
  }, [allocation]);

  const riskProfile = useMemo(() => {
    const eqPctNum = equityPct * 100;
    if (eqPctNum >= 65) return { label: 'Growth', description: 'Higher equity exposure for long-term growth potential' };
    if (eqPctNum >= 40) return { label: 'Balanced', description: 'A mix of equities and bonds for moderate growth with some stability' };
    return { label: 'Conservative', description: 'Lower equity exposure prioritizing capital preservation' };
  }, [equityPct]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="max-w-lg mx-auto"
    >
      <h2 className="font-serif text-2xl text-ws-text mb-1">Risk Profile</h2>
      <p className="text-sm text-ws-text-secondary mb-6">
        Review your portfolio and assumptions below, then finish. Editing coming soon.
      </p>

      {/* Portfolio summary */}
      <div className="bg-white rounded-xl border border-ws-border p-4 mb-4">
        <p className="text-xs text-ws-text-tertiary uppercase tracking-wider mb-2">Current allocation</p>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex-1 h-3 bg-ws-border rounded-full overflow-hidden flex">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${equityPct * 100}%` }}
            />
            <div
              className="h-full bg-emerald-500 transition-all"
              style={{ width: `${bondPct * 100}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            Equities {(equityPct * 100).toFixed(0)}%
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Bonds {(bondPct * 100).toFixed(0)}%
          </span>
          {(1 - equityPct - bondPct) > 0.01 && (
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-ws-border" />
              Other {((1 - equityPct - bondPct) * 100).toFixed(0)}%
            </span>
          )}
        </div>
        <div className="mt-3 pt-3 border-t border-ws-border">
          <p className="text-sm text-ws-text font-medium">
            Your portfolio aligns with a <span className="text-ws-green">{riskProfile.label}</span> profile
          </p>
          <p className="text-xs text-ws-text-tertiary mt-0.5">
            {riskProfile.description}
          </p>
        </div>
        <p className="text-xs text-ws-text-tertiary mt-2">
          Across {investmentAccounts.length} investment account{investmentAccounts.length !== 1 ? 's' : ''} totalling ${profile.totalNetWorth.toLocaleString()}
        </p>
      </div>

      <div className="space-y-3">
        <ReviewConfirmField
          label="CPP Benefit Rate"
          value={`${((profile.cppBenefitRate ?? 0.65) * 100).toFixed(0)}% of maximum`}
          editValue={Math.round((profile.cppBenefitRate ?? 0.65) * 100)}
          suffix="% of max"
          min={0}
          max={100}
          step={5}
          insight="Most Canadians receive about 60-70% of the maximum CPP"
          disabled
          onChange={(v) => updateField('cppBenefitRate', (v as number) / 100)}
        />
      </div>

      <div className="flex items-center justify-between mt-8">
        <button
          onClick={onBack}
          className="text-sm text-ws-text-secondary hover:text-ws-text transition-colors"
        >
          Back
        </button>
        <button
          onClick={onComplete}
          className="bg-ws-green text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-ws-green/90 transition-colors"
        >
          Finish and view simulator
        </button>
      </div>
    </motion.div>
  );
}
