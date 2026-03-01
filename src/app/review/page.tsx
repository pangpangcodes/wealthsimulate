'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence } from 'framer-motion';
import ReviewWelcome from '@/components/review/ReviewWelcome';
import ReviewStepEmployment from '@/components/review/ReviewStepEmployment';
import ReviewStepFinances from '@/components/review/ReviewStepFinances';
import ReviewStepGoals from '@/components/review/ReviewStepGoals';
import ReviewStepRisk from '@/components/review/ReviewStepRisk';
import ReviewProgress from '@/components/review/ReviewProgress';

const TOTAL_STEPS = 4;

export default function ReviewPage() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0 = welcome, 1-4 = steps

  const handleComplete = () => {
    router.push('/simulator');
  };

  return (
    <div className="min-h-screen bg-ws-bg">
      {/* Nav */}
      <nav className="border-b border-ws-border bg-white">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ws-black rounded-md flex items-center justify-center">
              <TrendingUp size={14} className="text-white" />
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight">Simulate</span>
          </Link>
          <Link
            href="/simulator"
            className="text-xs text-ws-text-tertiary hover:text-ws-text-secondary transition-colors"
          >
            Skip to simulator
          </Link>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {step > 0 && (
          <ReviewProgress currentStep={step} totalSteps={TOTAL_STEPS} />
        )}

        <AnimatePresence mode="wait">
          {step === 0 && (
            <ReviewWelcome key="welcome" onStart={() => setStep(1)} />
          )}
          {step === 1 && (
            <ReviewStepEmployment
              key="employment"
              onNext={() => setStep(2)}
              onBack={() => setStep(0)}
            />
          )}
          {step === 2 && (
            <ReviewStepFinances
              key="finances"
              onNext={() => setStep(3)}
              onBack={() => setStep(1)}
            />
          )}
          {step === 3 && (
            <ReviewStepGoals
              key="goals"
              onNext={() => setStep(4)}
              onBack={() => setStep(2)}
            />
          )}
          {step === 4 && (
            <ReviewStepRisk
              key="risk"
              onComplete={handleComplete}
              onBack={() => setStep(3)}
            />
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
