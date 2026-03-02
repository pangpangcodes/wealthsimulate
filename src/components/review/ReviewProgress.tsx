'use client';

const STEP_LABELS = ['Employment & Income', 'Personal Finances', 'Investment Goals'];

interface ReviewProgressProps {
  currentStep: number; // 1-4 (0 = welcome, not shown)
  totalSteps: number;
}

export default function ReviewProgress({ currentStep, totalSteps }: ReviewProgressProps) {
  const progress = currentStep / totalSteps;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-ws-text-tertiary">
          Step {currentStep} of {totalSteps}
        </span>
        <span className="text-xs font-medium text-ws-text-secondary">
          {STEP_LABELS[currentStep - 1]}
        </span>
      </div>
      <div className="h-1 bg-ws-border rounded-full overflow-hidden">
        <div
          className="h-full bg-ws-green rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
