'use client';

import { motion } from 'framer-motion';
import type { Transaction, TransactionCategory } from '@/lib/types';

const CATEGORY_BADGE_COLOURS: Record<TransactionCategory, string> = {
  income: 'bg-emerald-50 text-emerald-700',
  groceries: 'bg-orange-50 text-orange-700',
  dining: 'bg-rose-50 text-rose-700',
  transportation: 'bg-cyan-50 text-cyan-700',
  utilities: 'bg-violet-50 text-violet-700',
  subscriptions: 'bg-pink-50 text-pink-700',
  shopping: 'bg-amber-50 text-amber-700',
  entertainment: 'bg-indigo-50 text-indigo-700',
  health: 'bg-lime-50 text-lime-700',
  insurance: 'bg-slate-50 text-slate-700',
  transfer: 'bg-gray-50 text-gray-600',
  other: 'bg-gray-50 text-gray-600',
};

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  income: 'Income',
  groceries: 'Groceries',
  dining: 'Dining',
  transportation: 'Transport',
  utilities: 'Utilities',
  subscriptions: 'Subscription',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  health: 'Health',
  insurance: 'Insurance',
  transfer: 'Transfer',
  other: 'Other',
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(abs);
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
}

interface TransactionsListProps {
  transactions: Transaction[];
  maxItems?: number;
}

export default function TransactionsList({ transactions, maxItems = 8 }: TransactionsListProps) {
  const displayed = transactions.slice(0, maxItems);

  return (
    <div className="divide-y divide-ws-border">
      {displayed.map((txn, i) => (
        <motion.div
          key={txn.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: i * 0.02 }}
          className="px-5 py-2.5 flex items-center justify-between text-sm"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="text-ws-text-tertiary w-12 flex-shrink-0">{formatDate(txn.date)}</span>
            <span className="text-ws-text truncate">{txn.description}</span>
            <span className={`px-1.5 py-0.5 rounded text-xs flex-shrink-0 ${CATEGORY_BADGE_COLOURS[txn.category]}`}>
              {CATEGORY_LABELS[txn.category]}
            </span>
          </div>
          <span className={`font-medium tabular-nums flex-shrink-0 ml-3 ${txn.amount >= 0 ? 'text-ws-green' : 'text-ws-text'}`}>
            {formatAmount(txn.amount)}
          </span>
        </motion.div>
      ))}
      {transactions.length > maxItems && (
        <div className="px-5 py-2 text-center">
          <span className="text-xs text-ws-text-tertiary">
            +{transactions.length - maxItems} more transactions
          </span>
        </div>
      )}
    </div>
  );
}
