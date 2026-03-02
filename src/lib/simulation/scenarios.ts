import type { ScenarioOverrides } from '@/lib/types';

// -- Pre-built Scenario Templates ---------------------------------------------

export const PRESET_SCENARIOS: Record<string, ScenarioOverrides> = {
  baseline: {
    name: 'Current Path',
  },

  retireAt60: {
    name: 'Retire at 60',
    retirementAge: 60,
    annualSavingsRate: 0.15,
  },

  marketCrash: {
    name: 'Market Crash Next Year',
    marketCrash: {
      year: new Date().getFullYear() + 1,
      severity: 'severe',
    },
  },

  careerChange: {
    name: 'Career Change in 2028',
    careerChange: {
      year: 2028,
      newIncome: 55000,
      gapMonths: 6,
    },
  },

  boost15Pct: {
    name: 'Boost Savings to 15%',
    annualSavingsRate: 0.15,
  },

  monthlyDCA: {
    name: 'Monthly Contributions',
    contributionTiming: 'monthly',
  },

  jobLoss6Months: {
    name: 'Job Loss - 6 Month Gap',
    careerChange: {
      year: new Date().getFullYear() + 1,
      newIncome: 75000,
      gapMonths: 6,
    },
  },

  jobLoss12Months: {
    name: 'Job Loss - 12 Month Gap',
    careerChange: {
      year: new Date().getFullYear() + 1,
      newIncome: 75000,
      gapMonths: 12,
    },
  },
};

// -- Suggested Prompts --------------------------------------------------------

export const SUGGESTED_PROMPTS = [
  {
    label: 'Would switching to monthly contributions grow my money faster?',
    prompt: 'Would switching to monthly contributions grow my money faster than saving a lump sum once a year?',
    category: 'scenario' as const,
  },
  {
    label: 'What happens if I lose my job for 6 months?',
    prompt: 'What happens if I lose my job next year and it takes 6 months to find work?',
    category: 'scenario' as const,
  },
  {
    label: 'Am I on track to retire comfortably at 65?',
    prompt: 'Based on my current savings, am I on track for retirement at 65?',
    category: 'analysis' as const,
  },
];

// -- Life Event Probabilities (per year) --------------------------------------

export const LIFE_EVENT_PROBABILITIES = {
  jobLoss: 0.03,              // 3% chance per year
  jobLossRecoveryMonths: 6,   // average time to find new job
  medicalEmergency: 0.02,     // 2% chance per year
  medicalCost: 15000,         // average out-of-pocket (Canadian, still some costs)
  windfall: 0.01,             // 1% chance (inheritance, etc.)
  windfallAmount: 25000,
};
