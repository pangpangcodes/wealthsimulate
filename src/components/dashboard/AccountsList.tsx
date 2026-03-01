'use client';

import { useState } from 'react';
import { useProfileStore } from '@/lib/store/profile-store';
import { isInvestmentAccount } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import TransactionsList from './TransactionsList';
import PortfolioBreakdown from './PortfolioBreakdown';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  rrsp: 'RRSP',
  tfsa: 'TFSA',
  fhsa: 'FHSA',
  'non-registered': 'Non-Registered',
  resp: 'RESP',
  chequing: 'Chequing',
  'credit-card': 'Credit Card',
};

export default function AccountsList() {
  const profile = useProfileStore((s) => s.profile);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const bankingAccounts = profile.accounts.filter((a) => !isInvestmentAccount(a));
  const investmentAccounts = profile.accounts.filter(isInvestmentAccount);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-4">
      {/* Banking Accounts */}
      {bankingAccounts.length > 0 && (
        <div className="bg-white rounded-xl border border-ws-border">
          <div className="px-5 py-4 border-b border-ws-border flex items-center justify-between">
            <h3 className="text-base font-medium text-ws-text">Banking</h3>
            <span className="text-sm text-ws-text-tertiary">{bankingAccounts.length} account{bankingAccounts.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="divide-y divide-ws-border">
            {bankingAccounts.map((account, i) => {
              const isExpanded = expandedId === account.id;
              const txnCount = account.transactions?.length || 0;
              const isNegative = account.marketValue < 0;

              return (
                <div key={account.id}>
                  <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    onClick={() => txnCount > 0 && toggleExpand(account.id)}
                    className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-ws-hover transition-colors"
                  >
                    <div className="text-left">
                      <p className="text-base text-ws-text">{account.name}</p>
                      <p className="text-sm text-ws-text-tertiary">
                        {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                        {txnCount > 0 && ` - ${txnCount} transactions`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <p className={`text-base font-medium tabular-nums ${isNegative ? 'text-ws-red' : 'text-ws-text'}`}>
                        {formatCurrency(account.marketValue)}
                      </p>
                      {txnCount > 0 && (
                        <ChevronDown
                          size={14}
                          className={`text-ws-text-tertiary transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      )}
                    </div>
                  </motion.button>

                  <AnimatePresence>
                    {isExpanded && account.transactions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-ws-bg/50"
                      >
                        <TransactionsList transactions={account.transactions} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Investment Accounts */}
      <div className="bg-white rounded-xl border border-ws-border">
        <div className="px-5 py-4 border-b border-ws-border flex items-center justify-between">
          <h3 className="text-base font-medium text-ws-text">Investments</h3>
          <span className="text-sm text-ws-text-tertiary">{investmentAccounts.length} account{investmentAccounts.length !== 1 ? 's' : ''}</span>
        </div>

        <div className="divide-y divide-ws-border">
          {investmentAccounts.map((account, i) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.05 }}
              className="px-5 py-3.5 flex items-center justify-between hover:bg-ws-hover transition-colors"
            >
              <div>
                <p className="text-base text-ws-text">{account.name}</p>
                <p className="text-sm text-ws-text-tertiary">
                  {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                </p>
              </div>
              <p className="text-sm font-medium text-ws-text tabular-nums">
                {formatCurrency(account.marketValue)}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Portfolio Allocation */}
        <PortfolioBreakdown />

        {/* Investment Total */}
        <div className="px-5 py-3.5 border-t border-ws-border bg-ws-bg rounded-b-xl flex items-center justify-between">
          <p className="text-base font-medium text-ws-text">Total Investments</p>
          <p className="text-base font-semibold text-ws-text tabular-nums">
            {formatCurrency(profile.totalNetWorth)}
          </p>
        </div>
      </div>
    </div>
  );
}
