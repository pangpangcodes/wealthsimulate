import type { SimulationConfig, SimulationResults, ScenarioOverrides, FinancialProfile } from '@/lib/types';
import { runSimulation } from './engine';

// ─── Goal-Backward Planning (Binary Search Solver) ──────────────────────────
// Runs binary search over a controllable variable to find the value where
// moneyLastsToAge >= lifeExpectancy at P50. Uses 200 paths per iteration
// for speed (5-8 iterations).

export type SolvableVariable =
  | 'savings_rate'      // 0-0.8
  | 'retirement_age'    // 50-80
  | 'desired_retirement_income';  // 0 - 2x current

export interface GoalSolverConfig {
  variable: SolvableVariable;
  profile: FinancialProfile;
  scenario: ScenarioOverrides;
  /** Target: moneyLastsToAge >= this value at P50. Defaults to lifeExpectancy. */
  targetAge?: number;
  /** Number of paths per iteration (default 200 for speed) */
  pathsPerIteration?: number;
  /** Max iterations (default 8) */
  maxIterations?: number;
}

export interface GoalSolverResult {
  variable: SolvableVariable;
  solvedValue: number;
  /** The exact moneyLastsToAge at the solved value */
  moneyLastsToAge: number;
  /** Current value of the variable for comparison */
  currentValue: number;
  /** Full simulation results at the solved value */
  summary: {
    retirementAnnualIncomeP50: number;
    incomeReplacementRatio: number;
    retirementNetWorthP50: number;
    moneyLastsToAge: number;
    cppOasAnnualIncome: number;
  };
  iterations: number;
  converged: boolean;
}

const VARIABLE_BOUNDS: Record<SolvableVariable, [number, number]> = {
  savings_rate: [0, 0.80],
  retirement_age: [50, 80],
  desired_retirement_income: [0, 500000],
};

function getVariableValue(variable: SolvableVariable, profile: FinancialProfile, scenario: ScenarioOverrides): number {
  switch (variable) {
    case 'savings_rate':
      return scenario.annualSavingsRate ?? profile.annualSavingsRate;
    case 'retirement_age':
      return scenario.retirementAge ?? profile.retirementAge;
    case 'desired_retirement_income':
      return scenario.desiredRetirementIncome ?? profile.desiredRetirementIncome ?? profile.monthlyExpenses * 12;
  }
}

function applyVariable(scenario: ScenarioOverrides, variable: SolvableVariable, value: number): ScenarioOverrides {
  const updated = { ...scenario };
  switch (variable) {
    case 'savings_rate':
      updated.annualSavingsRate = value;
      break;
    case 'retirement_age':
      updated.retirementAge = Math.round(value);
      break;
    case 'desired_retirement_income':
      updated.desiredRetirementIncome = Math.round(value);
      break;
  }
  return updated;
}

function runQuickSimulation(config: SimulationConfig): SimulationResults {
  return runSimulation(config);
}

/**
 * Binary search over a variable to find the value where money lasts to target age.
 * For savings_rate: higher rate -> money lasts longer (search upward)
 * For retirement_age: higher age -> money lasts longer (search upward)
 * For desired_retirement_income: higher income -> money runs out sooner (search downward)
 */
export function solveForGoal(config: GoalSolverConfig): GoalSolverResult {
  const {
    variable,
    profile,
    scenario,
    pathsPerIteration = 200,
    maxIterations = 8,
  } = config;
  const targetAge = config.targetAge ?? profile.lifeExpectancy;
  const currentValue = getVariableValue(variable, profile, scenario);
  const [boundsLow, boundsHigh] = VARIABLE_BOUNDS[variable];

  // For desired_retirement_income, upper bound is 2x current expenses
  const effectiveHigh = variable === 'desired_retirement_income'
    ? Math.max(boundsHigh, profile.monthlyExpenses * 12 * 2)
    : boundsHigh;

  let low = boundsLow;
  let high = effectiveHigh;
  let bestResult: SimulationResults | null = null;
  let bestValue = currentValue;
  let iterations = 0;
  let converged = false;

  // Direction: for savings_rate and retirement_age, higher = better.
  // For desired_retirement_income, lower = better (less spending = money lasts longer).
  const isInverse = variable === 'desired_retirement_income';

  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    const mid = (low + high) / 2;
    const testScenario = applyVariable(scenario, variable, mid);

    const simConfig: SimulationConfig = {
      numPaths: pathsPerIteration,
      yearsToProject: Math.max(30, targetAge - profile.age + 5),
      startYear: new Date().getFullYear(),
      profile,
      scenario: testScenario,
    };

    const result = runQuickSimulation(simConfig);
    const meetsGoal = result.summary.moneyLastsToAge >= targetAge;

    bestResult = result;
    bestValue = mid;

    if (meetsGoal) {
      // We found a value that works - can we do better (lower savings / earlier retirement)?
      if (isInverse) {
        low = mid; // Try higher income (less conservative)
      } else {
        high = mid; // Try lower savings rate / earlier retirement
      }
    } else {
      // Doesn't meet goal - need more aggressive value
      if (isInverse) {
        high = mid; // Try lower income
      } else {
        low = mid; // Try higher savings rate / later retirement
      }
    }

    // Convergence check
    const tolerance = variable === 'savings_rate' ? 0.005 // 0.5% savings rate
      : variable === 'retirement_age' ? 0.5 // half a year
      : 500; // $500 income
    if (high - low < tolerance) {
      converged = true;
      // Take the conservative answer (the value that meets the goal)
      bestValue = isInverse ? mid : high;
      // Run one final simulation at the converged value
      const finalScenario = applyVariable(scenario, variable, bestValue);
      const finalConfig: SimulationConfig = {
        numPaths: pathsPerIteration,
        yearsToProject: Math.max(30, targetAge - profile.age + 5),
        startYear: new Date().getFullYear(),
        profile,
        scenario: finalScenario,
      };
      bestResult = runQuickSimulation(finalConfig);
      break;
    }
  }

  // Format the solved value nicely
  let solvedValue = bestValue;
  if (variable === 'savings_rate') {
    // Round to nearest 0.5%
    solvedValue = Math.round(bestValue * 200) / 200;
  } else if (variable === 'retirement_age') {
    solvedValue = Math.round(bestValue);
  } else {
    solvedValue = Math.round(bestValue / 100) * 100;
  }

  return {
    variable,
    solvedValue,
    moneyLastsToAge: bestResult?.summary.moneyLastsToAge ?? 0,
    currentValue,
    summary: {
      retirementAnnualIncomeP50: bestResult?.summary.retirementAnnualIncomeP50 ?? 0,
      incomeReplacementRatio: bestResult?.summary.incomeReplacementRatio ?? 0,
      retirementNetWorthP50: bestResult?.summary.retirementNetWorthP50 ?? 0,
      moneyLastsToAge: bestResult?.summary.moneyLastsToAge ?? 0,
      cppOasAnnualIncome: bestResult?.summary.cppOasAnnualIncome ?? 0,
    },
    iterations,
    converged,
  };
}
