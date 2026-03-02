import type { SimulationResults, FinancialProfile, ScenarioOverrides } from '@/lib/types';
import { GIS_INCOME_THRESHOLD_SINGLE } from './government-pensions';

// ─── Assumption Transparency ────────────────────────────────────────────────
// Every limitation string is deterministic and derivable from profile + scenario data.
// No AI generation. When the model can't compute something, it says so explicitly.

export interface Limitation {
  id: string;
  text: string;
  severity: 'info' | 'caution';
}

/**
 * Generate contextual limitations relevant to THIS user's profile and scenario.
 * Every statement is a verifiable fact about what the simulation does or doesn't include.
 */
export function getRelevantLimitations(
  profile: FinancialProfile,
  scenario: ScenarioOverrides,
  results: SimulationResults
): Limitation[] {
  const limitations: Limitation[] = [];
  const retirementAge = scenario.retirementAge ?? profile.retirementAge;

  // GIS eligibility notice
  if (results.summary.retirementAnnualIncomeP50 < GIS_INCOME_THRESHOLD_SINGLE) {
    limitations.push({
      id: 'gis-modelled',
      text: 'GIS (Guaranteed Income Supplement) is included in this simulation based on projected retirement income.',
      severity: 'info',
    });
  }

  // RRIF notice
  const rrspBalance = profile.accounts
    .filter((a) => a.type === 'rrsp')
    .reduce((sum, a) => sum + a.marketValue, 0);
  if (rrspBalance > 0 && retirementAge <= 71) {
    limitations.push({
      id: 'rrif-enforced',
      text: 'RRIF mandatory minimums are enforced after age 71. Forced withdrawals are added to taxable income.',
      severity: 'info',
    });
  }

  // No employer pension
  limitations.push({
    id: 'no-employer-pension',
    text: 'Employer pension plans (DB/DC) and employer RRSP matching are not modelled. If these apply, your actual retirement income may be higher.',
    severity: 'info',
  });

  // Provincial tax simplification
  limitations.push({
    id: 'provincial-simplified',
    text: `Provincial taxes use a simplified flat rate for ${profile.province}, not full provincial brackets. Actual provincial tax may differ.`,
    severity: 'info',
  });

  // No spousal income splitting
  limitations.push({
    id: 'no-spousal-splitting',
    text: 'Spousal income splitting and pension sharing are not modelled. Couples may have additional tax optimization options.',
    severity: 'info',
  });

  return limitations;
}

// ─── AI Confidence Level ────────────────────────────────────────────────────
// Computed from P10/P90 spread relative to P50, plus number of scenario overrides.

export type ConfidenceLevel = 'high' | 'moderate' | 'low';

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  spreadRatio: number;
  overrideCount: number;
  guidance: string;
}

/**
 * Compute confidence level from simulation result spread and scenario complexity.
 */
export function computeConfidence(
  results: SimulationResults,
  scenario: ScenarioOverrides
): ConfidenceAssessment {
  const p90 = results.summary.retirementNetWorthP90;
  const p10 = results.summary.retirementNetWorthP10;
  const p50 = results.summary.retirementNetWorthP50;

  // Spread ratio: how wide is the range relative to the median?
  const spreadRatio = p50 > 0 ? (p90 - p10) / p50 : 999;

  // Count scenario overrides (each adds uncertainty)
  let overrideCount = 0;
  if (scenario.retirementAge) overrideCount++;
  if (scenario.annualSavingsRate) overrideCount++;
  if (scenario.careerChange) overrideCount++;
  if (scenario.marketCrash) overrideCount++;
  if (scenario.inflationRate) overrideCount++;
  if (scenario.extraContributions) overrideCount++;

  let level: ConfidenceLevel;
  let guidance: string;

  if (spreadRatio < 1.5 && overrideCount <= 1) {
    level = 'high';
    guidance = 'The range of outcomes is relatively narrow - these projections are more reliable.';
  } else if (spreadRatio > 3 || overrideCount >= 3) {
    level = 'low';
    guidance = 'This scenario involves several compounding variables - treat specific numbers as directional, not precise.';
  } else {
    level = 'moderate';
    guidance = 'These projections give a reasonable range, but individual outcomes could vary.';
  }

  return { level, spreadRatio, overrideCount, guidance };
}

// ─── Input Validation ────────────────────────────────────────────────────────

export interface ValidationFlag {
  field: string;
  message: string;
  severity: 'warning' | 'error';
}

/**
 * Sanity-check profile values before simulation.
 * Returns flags for values that seem unrealistic.
 */
export function validateProfileInputs(profile: FinancialProfile): ValidationFlag[] {
  const flags: ValidationFlag[] = [];

  if (profile.annualIncome > 0 && profile.annualIncome < 15000) {
    flags.push({
      field: 'annualIncome',
      message: `Annual income of $${profile.annualIncome.toLocaleString()} is unusually low for a non-retired person. Please verify.`,
      severity: 'warning',
    });
  }

  if (profile.annualSavingsRate > 0.50) {
    flags.push({
      field: 'annualSavingsRate',
      message: `Savings rate of ${Math.round(profile.annualSavingsRate * 100)}% is very high. Most Canadians save 5-20%. Please verify this is correct.`,
      severity: 'warning',
    });
  }

  if (profile.lifeExpectancy < 75) {
    flags.push({
      field: 'lifeExpectancy',
      message: `Life expectancy of ${profile.lifeExpectancy} is below the Canadian average of ~82. This will significantly shorten the projection period.`,
      severity: 'warning',
    });
  }

  const monthlyIncome = profile.annualIncome / 12;
  if (profile.monthlyExpenses > monthlyIncome && monthlyIncome > 0) {
    flags.push({
      field: 'monthlyExpenses',
      message: `Monthly expenses ($${profile.monthlyExpenses.toLocaleString()}) exceed monthly gross income ($${Math.round(monthlyIncome).toLocaleString()}). This means you're spending more than you earn.`,
      severity: 'warning',
    });
  }

  return flags;
}
