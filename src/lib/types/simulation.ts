import type { AssetClass, FinancialProfile, FinancialGoal } from './financial';

// ─── Simulation Configuration ────────────────────────────────────────────────

export interface SimulationConfig {
  numPaths: number;        // default 1000
  yearsToProject: number;  // default 30
  startYear: number;
  profile: FinancialProfile;
  scenario: ScenarioOverrides;
}

export interface ScenarioOverrides {
  name: string;
  retirementAge?: number;
  annualSavingsRate?: number;
  additionalIncome?: number;
  homePurchase?: {
    year: number;
    price: number;
    downPaymentPercent: number;
  };
  children?: {
    year: number;
    annualCostIncrease: number; // additional annual expense
  }[];
  careerChange?: {
    year: number;
    newIncome: number;
    gapMonths: number;
  };
  marketCrash?: {
    year: number;
    severity: 'mild' | 'moderate' | 'severe'; // -15%, -30%, -45%
  };
  extraContributions?: {
    accountType: string;
    annualAmount: number;
    startYear: number;
    endYear: number;
  };
  contributionTiming?: 'annual' | 'monthly';
  inflationRate?: number;
  lifeExpectancy?: number;
  desiredRetirementIncome?: number;
}

// ─── Asset Class Parameters ──────────────────────────────────────────────────

export interface AssetClassParams {
  expectedReturn: number;   // annualized mean
  volatility: number;       // annualized std dev
  assetClass: AssetClass;
}

// ─── Simulation Results ──────────────────────────────────────────────────────

export interface SimulationResults {
  id: string;
  scenarioName: string;
  timestamp: number;
  config: SimulationConfig;

  // Per-year percentile data
  yearlyData: YearlyPercentiles[];

  // Summary metrics
  summary: SimulationSummary;

  // Path count info
  validPaths: number;
  totalPaths: number;
}

export interface YearlyPercentiles {
  year: number;
  age: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  mean: number;
}

export interface SimulationSummary {
  // Net worth at retirement
  retirementNetWorthP50: number;
  retirementNetWorthP10: number;
  retirementNetWorthP90: number;

  // Retirement readiness
  retirementSuccessRate: number; // % of paths where money lasts through life expectancy

  // Time-based
  yearsToGoal: number | null;
  peakNetWorthYear: number;

  // Risk metrics
  worstCaseNetWorth: number;
  bestCaseNetWorth: number;
  probabilityOfRuin: number; // % of paths that go to $0

  // Goal analysis
  goalOutcomes: GoalOutcome[];

  // New income-based metrics
  retirementAnnualIncomeP50: number;  // net retirement income (after all taxes), in today's dollars
  incomeReplacementRatio: number;     // net retirement income / after-tax working income
  incomeReplacementTarget: number;    // the denominator used (after-tax working income, today's dollars)
  moneyLastsToAge: number;            // P50 age when portfolio depletes (or lifeExpectancy)
  cppOasAnnualIncome: number;         // government pension component at 65, today's dollars
}

export interface GoalOutcome {
  goal: FinancialGoal;
  probabilityOfSuccess: number;
  medianYearAchieved: number | null;
  shortfallP50: number; // 0 if goal met
}

// ─── Scenario Comparison ─────────────────────────────────────────────────────

export interface ScenarioComparison {
  scenarios: SimulationResults[];
  deltas: ScenarioDelta[];
}

export interface ScenarioDelta {
  metricName: string;
  baseValue: number;
  comparisonValue: number;
  delta: number;
  deltaPercent: number;
  favoursScenario: string;
}

// ─── Worker Messages ─────────────────────────────────────────────────────────

export interface WorkerRequest {
  type: 'run_simulation';
  config: SimulationConfig;
}

export interface WorkerResponse {
  type: 'simulation_complete' | 'simulation_error' | 'simulation_progress';
  results?: SimulationResults;
  error?: string;
  progress?: number; // 0-1
}
