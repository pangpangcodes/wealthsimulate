// ─── Account & Portfolio Types ───────────────────────────────────────────────

export type AccountType = 'rrsp' | 'tfsa' | 'fhsa' | 'non-registered' | 'resp' | 'chequing' | 'credit-card';

export type TransactionCategory =
  | 'income'
  | 'groceries'
  | 'dining'
  | 'transportation'
  | 'utilities'
  | 'subscriptions'
  | 'shopping'
  | 'entertainment'
  | 'health'
  | 'insurance'
  | 'transfer'
  | 'other';

export interface Transaction {
  id: string;
  date: string; // ISO date string
  description: string;
  amount: number; // positive = credit/deposit, negative = debit/charge
  category: TransactionCategory;
  isRecurring?: boolean;
}

const INVESTMENT_TYPES: AccountType[] = ['rrsp', 'tfsa', 'fhsa', 'non-registered', 'resp'];

export function isInvestmentAccount(account: { type: AccountType }): boolean {
  return INVESTMENT_TYPES.includes(account.type);
}

export interface Holding {
  ticker: string;
  name: string;
  assetClass: AssetClass;
  marketValue: number;
  allocation: number; // 0-1
  currency: 'CAD' | 'USD';
}

export type AssetClass =
  | 'canadian-equity'
  | 'us-equity'
  | 'international-equity'
  | 'emerging-markets'
  | 'canadian-bonds'
  | 'international-bonds'
  | 'high-yield-bonds'
  | 'gold'
  | 'cash'
  | 'real-estate';

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  marketValue: number;
  holdings: Holding[];
  contributionRoom?: number;
  transactions?: Transaction[];
}

export interface FinancialProfile {
  // Personal
  age: number;
  province: Province;
  annualIncome: number;
  monthlyExpenses: number;
  annualSavingsRate: number; // 0-1

  // Portfolio
  accounts: Account[];
  totalNetWorth: number;

  // Goals
  goals: FinancialGoal[];

  // Assumptions
  inflationRate: number;
  retirementAge: number;
  lifeExpectancy: number;

  // Government pensions
  cppBenefitRate?: number;           // 0-1, fraction of max CPP (default 0.65)

  // Retirement income target
  desiredRetirementIncome?: number;  // annual, today's dollars. Default: monthlyExpenses * 12
}

export type Province =
  | 'ON' | 'BC' | 'AB' | 'QC' | 'MB'
  | 'SK' | 'NS' | 'NB' | 'NL' | 'PE'
  | 'YT' | 'NT' | 'NU';

export interface FinancialGoal {
  id: string;
  type: GoalType;
  name: string;
  targetAmount: number;
  targetYear: number;
  priority: 'essential' | 'important' | 'aspirational';
}

export type GoalType =
  | 'retirement'
  | 'home-purchase'
  | 'education'
  | 'emergency-fund'
  | 'major-purchase'
  | 'debt-payoff'
  | 'custom';

// ─── Allocation Summary ─────────────────────────────────────────────────────

export interface AllocationSummary {
  assetClass: AssetClass;
  label: string;
  value: number;
  percentage: number;
  colour: string;
}
