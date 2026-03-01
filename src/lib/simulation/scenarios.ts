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

  homePurchase2028: {
    name: 'Buy a Home in 2028',
    homePurchase: {
      year: 2028,
      price: 600000,
      downPaymentPercent: 0.10,
    },
  },

  homePurchase2030: {
    name: 'Buy a Home in 2030',
    homePurchase: {
      year: 2030,
      price: 650000,
      downPaymentPercent: 0.10,
    },
  },

  marketCrash: {
    name: 'Market Crash Next Year',
    marketCrash: {
      year: new Date().getFullYear() + 1,
      severity: 'severe',
    },
  },

  childIn2029: {
    name: 'Have a Child in 2029',
    children: [
      { year: 2029, annualCostIncrease: 18000 },
    ],
  },

  twoChildren: {
    name: 'Two Children (2029, 2032)',
    children: [
      { year: 2029, annualCostIncrease: 18000 },
      { year: 2032, annualCostIncrease: 18000 },
    ],
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
    label: 'Am I on track to retire comfortably at 65?',
    prompt: 'Based on my current savings, am I on track for retirement at 65?',
    category: 'analysis' as const,
  },
  {
    label: 'Would switching to monthly contributions grow my money faster?',
    prompt: 'Is my habit of saving a lump sum each February costing me? What if I switched to monthly?',
    category: 'scenario' as const,
  },
  {
    label: 'What happens if I lose my job for 6 months?',
    prompt: 'What happens if I lose my job next year and it takes 6 months to find work?',
    category: 'scenario' as const,
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
