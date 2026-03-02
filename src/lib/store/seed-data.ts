import type { FinancialProfile } from '@/lib/types';
import { SEED_CHEQUING_ACCOUNT, SEED_CREDIT_CARD_ACCOUNT, SEED_RRSP_TRANSACTIONS } from './seed-transactions';

export const SEED_PROFILE: FinancialProfile = {
  age: 33,
  province: 'ON',
  annualIncome: 75000,
  monthlyExpenses: 3400,
  annualSavingsRate: 0.093,
  inflationRate: 0.022,
  retirementAge: 65,
  lifeExpectancy: 90,
  cppBenefitRate: 0.65,

  accounts: [
    {
      id: 'seed-rrsp',
      name: 'RRSP',
      type: 'rrsp',
      marketValue: 18000,
      holdings: [
        { ticker: 'XIC', name: 'iShares Core S&P/TSX', assetClass: 'canadian-equity', marketValue: 5400, allocation: 0.30, currency: 'CAD' },
        { ticker: 'XUU', name: 'iShares Core S&P US', assetClass: 'us-equity', marketValue: 7200, allocation: 0.40, currency: 'CAD' },
        { ticker: 'ZAG', name: 'BMO Aggregate Bond', assetClass: 'canadian-bonds', marketValue: 5400, allocation: 0.30, currency: 'CAD' },
      ],
      transactions: SEED_RRSP_TRANSACTIONS,
    },
    {
      id: 'seed-tfsa',
      name: 'TFSA',
      type: 'tfsa',
      marketValue: 7000,
      holdings: [
        { ticker: 'XIC', name: 'iShares Core S&P/TSX', assetClass: 'canadian-equity', marketValue: 1750, allocation: 0.25, currency: 'CAD' },
        { ticker: 'XUU', name: 'iShares Core S&P US', assetClass: 'us-equity', marketValue: 3500, allocation: 0.50, currency: 'CAD' },
        { ticker: 'XEF', name: 'iShares MSCI EAFE', assetClass: 'international-equity', marketValue: 1750, allocation: 0.25, currency: 'CAD' },
      ],
    },
    {
      id: 'seed-nonreg',
      name: 'Non-Registered',
      type: 'non-registered',
      marketValue: 0,
      holdings: [],
    },
    SEED_CHEQUING_ACCOUNT,
    SEED_CREDIT_CARD_ACCOUNT,
  ],

  totalNetWorth: 25000,

  goals: [],
};
