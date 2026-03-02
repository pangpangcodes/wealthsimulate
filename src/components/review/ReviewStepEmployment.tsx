'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useProfileStore } from '@/lib/store/profile-store';
import { SEED_PROFILE } from '@/lib/store/seed-data';
import { detectBiweeklyIncome } from '@/lib/analysis/income-detection';
import ReviewConfirmField from './ReviewConfirmField';
import type { Province } from '@/lib/types';

const PROVINCE_OPTIONS = [
  { value: 'ON', label: 'Ontario' },
  { value: 'BC', label: 'British Columbia' },
  { value: 'AB', label: 'Alberta' },
  { value: 'QC', label: 'Quebec' },
  { value: 'MB', label: 'Manitoba' },
  { value: 'SK', label: 'Saskatchewan' },
  { value: 'NS', label: 'Nova Scotia' },
  { value: 'NB', label: 'New Brunswick' },
  { value: 'NL', label: 'Newfoundland & Labrador' },
  { value: 'PE', label: 'Prince Edward Island' },
  { value: 'YT', label: 'Yukon' },
  { value: 'NT', label: 'Northwest Territories' },
  { value: 'NU', label: 'Nunavut' },
];

interface ReviewStepEmploymentProps {
  onNext: () => void;
  onBack: () => void;
}

export default function ReviewStepEmployment({ onNext, onBack }: ReviewStepEmploymentProps) {
  const profile = useProfileStore((s) => s.profile);
  const updateField = useProfileStore((s) => s.updateField);
  const getBankingAccounts = useProfileStore((s) => s.getBankingAccounts);

  const incomeInsight = useMemo(() => {
    const banking = getBankingAccounts();
    const chequing = banking.find((a) => a.type === 'chequing');
    if (!chequing?.transactions) return null;
    return detectBiweeklyIncome(chequing.transactions);
  }, [getBankingAccounts]);

  // Apply AI-detected income only if the user hasn't manually edited it
  useEffect(() => {
    if (incomeInsight && profile.annualIncome === SEED_PROFILE.annualIncome) {
      updateField('annualIncome', incomeInsight.estimatedAnnualIncome);
    }
  }, [incomeInsight, updateField, profile.annualIncome]);

  const provinceName = PROVINCE_OPTIONS.find((p) => p.value === profile.province)?.label || profile.province;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="max-w-lg mx-auto"
    >
      <h2 className="font-serif text-2xl text-ws-text mb-1">Employment & Income</h2>
      <p className="text-sm text-ws-text-secondary mb-6">
        Review your employment details below, then confirm & continue. Editing coming soon.
      </p>

      {incomeInsight && (
        <div className="bg-ws-green-light rounded-xl p-4 mb-4 flex items-start gap-3">
          <Sparkles size={16} className="text-ws-green mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-ws-text">
              We detected biweekly deposits of ~${incomeInsight.biweeklyAmount.toLocaleString()}
            </p>
            <p className="text-xs text-ws-text-secondary mt-0.5">
              {incomeInsight.explanation}. Estimated gross annual income: ~${incomeInsight.estimatedAnnualIncome.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <ReviewConfirmField
          label="Annual Income (Gross)"
          value={`$${profile.annualIncome.toLocaleString()}`}
          editValue={profile.annualIncome}
          prefix="$"
          min={0}
          max={1000000}
          step={1000}
          insight={incomeInsight ? `Based on your deposit pattern (${incomeInsight.confidence} confidence)` : undefined}
          disabled
          onChange={(v) => updateField('annualIncome', Math.round(v as number))}
        />

        <ReviewConfirmField
          label="Province of Residence"
          value={provinceName}
          editValue={profile.province}
          type="select"
          options={PROVINCE_OPTIONS}
          disabled
          onChange={(v) => updateField('province', v as Province)}
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
          onClick={onNext}
          className="bg-ws-dark text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-ws-black transition-colors"
        >
          Confirm & continue
        </button>
      </div>
    </motion.div>
  );
}
