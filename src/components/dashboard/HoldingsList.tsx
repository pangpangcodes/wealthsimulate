'use client';

import { useMemo } from 'react';
import { useProfileStore } from '@/lib/store/profile-store';
import { isInvestmentAccount } from '@/lib/types';
import { motion } from 'framer-motion';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const TICKER_COLOURS: Record<string, string> = {
  VTI: '#3b82f6',
  XIC: '#ef4444',
  XEF: '#8b5cf6',
  ZAG: '#10b981',
  EEMV: '#f59e0b',
  GLDM: '#eab308',
  XUU: '#06b6d4',
  ZCB: '#84cc16',
  ZHY: '#f97316',
  XEQT: '#ec4899',
  HXS: '#6366f1',
  HXDM: '#14b8a6',
  HXEM: '#a855f7',
};

export default function HoldingsList() {
  const profile = useProfileStore((s) => s.profile);

  // Aggregate holdings across all accounts
  const holdings = useMemo(() => {
    const map = new Map<string, { ticker: string; name: string; totalValue: number }>();
    for (const account of profile.accounts) {
      if (!isInvestmentAccount(account)) continue;
      for (const holding of account.holdings) {
        const existing = map.get(holding.ticker);
        if (existing) {
          existing.totalValue += holding.marketValue;
        } else {
          map.set(holding.ticker, {
            ticker: holding.ticker,
            name: holding.name,
            totalValue: holding.marketValue,
          });
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [profile.accounts]);

  return (
    <div className="bg-white rounded-xl border border-ws-border">
      <div className="px-5 py-4 border-b border-ws-border flex items-center justify-between">
        <h3 className="text-base font-medium text-ws-text">Holdings</h3>
      </div>

      <div className="divide-y divide-ws-border">
        {holdings.map((holding, i) => (
          <motion.div
            key={holding.ticker}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.03 }}
            className="px-5 py-3 flex items-center justify-between hover:bg-ws-hover transition-colors"
          >
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                style={{ backgroundColor: TICKER_COLOURS[holding.ticker] || '#6b7280' }}
              >
                {holding.ticker.slice(0, 2)}
              </div>
              <div>
                <p className="text-base font-medium text-ws-text">{holding.ticker}</p>
                <p className="text-sm text-ws-text-tertiary truncate max-w-[140px]">{holding.name}</p>
              </div>
            </div>
            <p className="text-base text-ws-text tabular-nums">{formatCurrency(holding.totalValue)} CAD</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
