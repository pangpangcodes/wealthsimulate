import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { FinancialProfile, FinancialGoal, Account, AllocationSummary, AssetClass } from '@/lib/types';
import { isInvestmentAccount } from '@/lib/types';
import { SEED_PROFILE } from './seed-data';

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  'canadian-equity': 'Canadian Equity',
  'us-equity': 'US Equity',
  'international-equity': 'International Equity',
  'emerging-markets': 'Emerging Markets',
  'canadian-bonds': 'Canadian Bonds',
  'international-bonds': 'International Bonds',
  'high-yield-bonds': 'High Yield Bonds',
  'gold': 'Gold',
  'cash': 'Cash',
  'real-estate': 'Real Estate',
};

const ASSET_CLASS_COLOURS: Record<AssetClass, string> = {
  'canadian-equity': '#ef4444',
  'us-equity': '#3b82f6',
  'international-equity': '#8b5cf6',
  'emerging-markets': '#f59e0b',
  'canadian-bonds': '#10b981',
  'international-bonds': '#06b6d4',
  'high-yield-bonds': '#84cc16',
  'gold': '#eab308',
  'cash': '#6b7280',
  'real-estate': '#ec4899',
};

interface ParsedStatementData {
  accounts: {
    name: string;
    type: 'rrsp' | 'tfsa' | 'fhsa' | 'non-registered' | 'resp';
    marketValue: number;
    holdings: {
      ticker: string;
      name: string;
      marketValue: number;
      assetClass: AssetClass;
      currency: 'CAD' | 'USD';
    }[];
  }[];
  totalValue: number;
}

interface ProfileState {
  profile: FinancialProfile;
  isOnboarded: boolean;

  // Actions
  setProfile: (profile: FinancialProfile) => void;
  updateField: <K extends keyof FinancialProfile>(key: K, value: FinancialProfile[K]) => void;
  addGoal: (goal: FinancialGoal) => void;
  removeGoal: (goalId: string) => void;
  addAccount: (account: Account) => void;
  setOnboarded: (value: boolean) => void;
  resetProfile: () => void;
  loadSeedProfile: () => void;
  loadFromStatement: (data: ParsedStatementData) => void;

  // Computed
  getAllocationSummary: () => AllocationSummary[];
  getAccountsByType: () => Record<string, Account[]>;
  getInvestmentAccounts: () => Account[];
  getBankingAccounts: () => Account[];
}

export const useProfileStore = create<ProfileState>()(
  persist(
    (set, get) => ({
      profile: SEED_PROFILE,
      isOnboarded: false,

      setProfile: (profile) => set({ profile }),

      updateField: (key, value) =>
        set((state) => ({
          profile: { ...state.profile, [key]: value },
        })),

      addGoal: (goal) =>
        set((state) => ({
          profile: {
            ...state.profile,
            goals: [...state.profile.goals, goal],
          },
        })),

      removeGoal: (goalId) =>
        set((state) => ({
          profile: {
            ...state.profile,
            goals: state.profile.goals.filter((g) => g.id !== goalId),
          },
        })),

      addAccount: (account) =>
        set((state) => ({
          profile: {
            ...state.profile,
            accounts: [...state.profile.accounts, account],
            totalNetWorth: isInvestmentAccount(account)
              ? state.profile.totalNetWorth + account.marketValue
              : state.profile.totalNetWorth,
          },
        })),

      setOnboarded: (value) => set({ isOnboarded: value }),

      resetProfile: () => set({ profile: SEED_PROFILE, isOnboarded: false }),

      loadSeedProfile: () => set({ profile: SEED_PROFILE }),

      loadFromStatement: (data: ParsedStatementData) =>
        set((state) => {
          const accounts: Account[] = data.accounts.map((acct, i) => ({
            id: `imported-${acct.type}-${i}`,
            name: acct.name,
            type: acct.type,
            marketValue: acct.marketValue,
            holdings: acct.holdings.map((h) => {
              const acctTotal = acct.marketValue || 1;
              return {
                ticker: h.ticker,
                name: h.name,
                assetClass: h.assetClass,
                marketValue: h.marketValue,
                allocation: acctTotal > 0 ? h.marketValue / acctTotal : 0,
                currency: h.currency,
              };
            }),
          }));

          return {
            profile: {
              ...state.profile,
              accounts,
              totalNetWorth: data.totalValue,
            },
          };
        }),

      getAllocationSummary: () => {
        const { profile } = get();
        const totals: Partial<Record<AssetClass, number>> = {};

        for (const account of profile.accounts) {
          if (!isInvestmentAccount(account)) continue;
          for (const holding of account.holdings) {
            totals[holding.assetClass] =
              (totals[holding.assetClass] || 0) + holding.marketValue;
          }
        }

        const totalValue = Object.values(totals).reduce((a, b) => a + (b || 0), 0);

        return Object.entries(totals)
          .filter(([, value]) => (value || 0) > 0)
          .map(([assetClass, value]) => ({
            assetClass: assetClass as AssetClass,
            label: ASSET_CLASS_LABELS[assetClass as AssetClass],
            value: value || 0,
            percentage: totalValue > 0 ? (value || 0) / totalValue : 0,
            colour: ASSET_CLASS_COLOURS[assetClass as AssetClass],
          }))
          .sort((a, b) => b.value - a.value);
      },

      getAccountsByType: () => {
        const { profile } = get();
        const grouped: Record<string, Account[]> = {};
        for (const account of profile.accounts) {
          if (!grouped[account.type]) grouped[account.type] = [];
          grouped[account.type].push(account);
        }
        return grouped;
      },

      getInvestmentAccounts: () => {
        const { profile } = get();
        return profile.accounts.filter(isInvestmentAccount);
      },

      getBankingAccounts: () => {
        const { profile } = get();
        return profile.accounts.filter((a) => !isInvestmentAccount(a));
      },
    }),
    {
      name: 'financial-profile-v3',
      version: 6,
      migrate: (persisted: unknown, version: number) => {
        if (version < 6) {
          return { profile: SEED_PROFILE, isOnboarded: false };
        }
        return persisted;
      },
    }
  )
);
