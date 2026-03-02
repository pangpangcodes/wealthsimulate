'use client';

import { motion } from 'framer-motion';
import { useProfileStore } from '@/lib/store/profile-store';
import ReviewConfirmField from './ReviewConfirmField';

interface ReviewStepGoalsProps {
  onNext: () => void;
  onBack: () => void;
}

export default function ReviewStepGoals({ onNext, onBack }: ReviewStepGoalsProps) {
  const profile = useProfileStore((s) => s.profile);
  const updateField = useProfileStore((s) => s.updateField);

  const desiredIncome = profile.desiredRetirementIncome ?? profile.monthlyExpenses * 12;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="max-w-lg mx-auto"
    >
      <h2 className="font-serif text-2xl text-ws-text mb-1">Investment Goals</h2>
      <p className="text-sm text-ws-text-secondary mb-6">
        Review your goals below, then confirm & continue. Editing coming soon.
      </p>

      <div className="space-y-3">
        <ReviewConfirmField
          label="Retirement Age"
          value={String(profile.retirementAge)}
          editValue={profile.retirementAge}
          min={50}
          max={75}
          disabled
          onChange={(v) => updateField('retirementAge', Math.round(v as number))}
        />

        <ReviewConfirmField
          label="Desired Retirement Income"
          value={`$${desiredIncome.toLocaleString()}/yr`}
          editValue={desiredIncome}
          prefix="$"
          suffix="/yr"
          min={0}
          max={500000}
          step={1000}
          insight="In today's dollars, based on your current annual expenses"
          disabled
          onChange={(v) => updateField('desiredRetirementIncome', Math.round(v as number))}
        />

        <ReviewConfirmField
          label="Life Expectancy"
          value={`Age ${profile.lifeExpectancy}`}
          editValue={profile.lifeExpectancy}
          min={70}
          max={105}
          disabled
          onChange={(v) => updateField('lifeExpectancy', Math.round(v as number))}
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
          className="bg-ws-green text-white rounded-full px-6 py-2.5 text-sm font-medium hover:bg-ws-green/90 transition-colors"
        >
          Finish and view simulator
        </button>
      </div>
    </motion.div>
  );
}
