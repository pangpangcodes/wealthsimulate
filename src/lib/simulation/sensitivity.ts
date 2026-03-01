import type { SimulationConfig, SimulationResults, ScenarioOverrides, FinancialProfile } from '@/lib/types';
import { runSimulation } from './engine';

// ─── Sensitivity Analysis ────────────────────────────────────────────────────
// Runs 5 quick simulations (100 paths each) with one variable perturbed at a
// time. Reports how each perturbation affects a key metric.
// All numbers come from actual simulation runs - never approximated.

export interface SensitivityVariable {
  name: string;
  label: string;
  perturbation: string;
  metric: string;
  baseValue: number;
  lowValue: number;
  highValue: number;
  lowDelta: number;
  highDelta: number;
  /** Absolute max delta (used for sorting by impact magnitude) */
  maxAbsDelta: number;
}

export interface SensitivityResult {
  variables: SensitivityVariable[];
  baseMetrics: {
    retirementAnnualIncomeP50: number;
    moneyLastsToAge: number;
    retirementNetWorthP50: number;
    incomeReplacementRatio: number;
  };
  pathsPerRun: number;
}

interface PerturbConfig {
  name: string;
  label: string;
  perturbation: string;
  metric: 'retirementAnnualIncomeP50' | 'moneyLastsToAge' | 'retirementNetWorthP50' | 'incomeReplacementRatio';
  metricLabel: string;
  applyLow: (s: ScenarioOverrides, p: FinancialProfile) => ScenarioOverrides;
  applyHigh: (s: ScenarioOverrides, p: FinancialProfile) => ScenarioOverrides;
}

const PERTURBATIONS: PerturbConfig[] = [
  {
    name: 'savings_rate',
    label: 'Savings Rate',
    perturbation: '+/- 5 percentage points',
    metric: 'retirementAnnualIncomeP50',
    metricLabel: 'Retirement Income',
    applyLow: (s, p) => ({
      ...s,
      annualSavingsRate: Math.max(0, (s.annualSavingsRate ?? p.annualSavingsRate) - 0.05),
    }),
    applyHigh: (s, p) => ({
      ...s,
      annualSavingsRate: Math.min(0.8, (s.annualSavingsRate ?? p.annualSavingsRate) + 0.05),
    }),
  },
  {
    name: 'retirement_age',
    label: 'Retirement Age',
    perturbation: '+/- 3 years',
    metric: 'moneyLastsToAge',
    metricLabel: 'Money Lasts To',
    applyLow: (s, p) => ({
      ...s,
      retirementAge: Math.max(50, (s.retirementAge ?? p.retirementAge) - 3),
    }),
    applyHigh: (s, p) => ({
      ...s,
      retirementAge: Math.min(80, (s.retirementAge ?? p.retirementAge) + 3),
    }),
  },
  {
    name: 'expected_returns',
    label: 'Market Returns',
    perturbation: '+/- 2 percentage points',
    metric: 'retirementNetWorthP50',
    metricLabel: 'Net Worth at Retirement',
    // Directly shift all asset class expected returns
    applyLow: (s) => ({
      ...s,
      returnAdjustment: (s.returnAdjustment ?? 0) - 0.02,
    }),
    applyHigh: (s) => ({
      ...s,
      returnAdjustment: (s.returnAdjustment ?? 0) + 0.02,
    }),
  },
  {
    name: 'inflation',
    label: 'Inflation Rate',
    perturbation: '+/- 1 percentage point',
    metric: 'retirementAnnualIncomeP50',
    metricLabel: 'Retirement Income',
    applyLow: (s, p) => ({
      ...s,
      inflationRate: Math.max(0, (s.inflationRate ?? p.inflationRate) - 0.01),
    }),
    applyHigh: (s, p) => ({
      ...s,
      inflationRate: (s.inflationRate ?? p.inflationRate) + 0.01,
    }),
  },
  {
    name: 'life_expectancy',
    label: 'Life Expectancy',
    perturbation: '+/- 5 years',
    metric: 'incomeReplacementRatio',
    metricLabel: 'Income Replacement',
    applyLow: (s, p) => ({
      ...s,
      lifeExpectancy: Math.max(70, (s.lifeExpectancy ?? p.lifeExpectancy) - 5),
    }),
    applyHigh: (s, p) => ({
      ...s,
      lifeExpectancy: (s.lifeExpectancy ?? p.lifeExpectancy) + 5,
    }),
  },
];

/**
 * Run sensitivity analysis: perturb each variable independently and measure impact.
 */
export function runSensitivityAnalysis(
  profile: FinancialProfile,
  scenario: ScenarioOverrides,
  pathsPerRun: number = 100,
  onProgress?: (progress: number) => void
): SensitivityResult {
  const startYear = new Date().getFullYear();
  const yearsToProject = Math.max(30, profile.lifeExpectancy - profile.age + 5);

  // Run baseline first
  const baseConfig: SimulationConfig = {
    numPaths: pathsPerRun,
    yearsToProject,
    startYear,
    profile,
    scenario,
  };
  const baseResult = runSimulation(baseConfig);
  const baseMetrics = {
    retirementAnnualIncomeP50: baseResult.summary.retirementAnnualIncomeP50,
    moneyLastsToAge: baseResult.summary.moneyLastsToAge,
    retirementNetWorthP50: baseResult.summary.retirementNetWorthP50,
    incomeReplacementRatio: baseResult.summary.incomeReplacementRatio,
  };

  if (onProgress) onProgress(1 / (PERTURBATIONS.length * 2 + 1));

  const variables: SensitivityVariable[] = [];

  for (let i = 0; i < PERTURBATIONS.length; i++) {
    const p = PERTURBATIONS[i];

    // Run low perturbation
    const lowScenario = p.applyLow(scenario, profile);
    const lowConfig: SimulationConfig = {
      numPaths: pathsPerRun,
      yearsToProject,
      startYear,
      profile,
      scenario: lowScenario,
    };
    const lowResult = runSimulation(lowConfig);

    if (onProgress) onProgress((2 + i * 2) / (PERTURBATIONS.length * 2 + 1));

    // Run high perturbation
    const highScenario = p.applyHigh(scenario, profile);
    const highConfig: SimulationConfig = {
      numPaths: pathsPerRun,
      yearsToProject,
      startYear,
      profile,
      scenario: highScenario,
    };
    const highResult = runSimulation(highConfig);

    if (onProgress) onProgress((3 + i * 2) / (PERTURBATIONS.length * 2 + 1));

    const baseVal = baseMetrics[p.metric];
    const lowVal = lowResult.summary[p.metric];
    const highVal = highResult.summary[p.metric];

    variables.push({
      name: p.name,
      label: p.label,
      perturbation: p.perturbation,
      metric: p.metricLabel,
      baseValue: baseVal,
      lowValue: lowVal,
      highValue: highVal,
      lowDelta: lowVal - baseVal,
      highDelta: highVal - baseVal,
      maxAbsDelta: Math.max(Math.abs(lowVal - baseVal), Math.abs(highVal - baseVal)),
    });
  }

  // Sort by impact magnitude (descending)
  variables.sort((a, b) => b.maxAbsDelta - a.maxAbsDelta);

  return { variables, baseMetrics, pathsPerRun };
}
