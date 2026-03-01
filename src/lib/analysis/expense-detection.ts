import type { Transaction, TransactionCategory } from '@/lib/types';

export interface CategoryBreakdown {
  category: TransactionCategory;
  label: string;
  monthlyAmount: number;
  transactionCount: number;
}

export interface ExpenseDetectionResult {
  estimatedMonthlyExpenses: number;
  byCategory: CategoryBreakdown[];
  explanation: string;
}

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  income: 'Income',
  groceries: 'Groceries',
  dining: 'Dining Out',
  transportation: 'Transportation',
  utilities: 'Utilities',
  subscriptions: 'Subscriptions',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  health: 'Health & Fitness',
  insurance: 'Insurance',
  transfer: 'Transfers',
  other: 'Other',
};

// Categories to exclude from expense total
const EXCLUDED_CATEGORIES: TransactionCategory[] = ['income', 'transfer'];

/**
 * Derives monthly expenses from chequing and credit card transactions.
 * Sums debits by category and normalizes to a monthly amount.
 */
export function deriveMonthlyExpenses(
  chequingTxns: Transaction[],
  creditCardTxns: Transaction[]
): ExpenseDetectionResult {
  const allTxns = [...chequingTxns, ...creditCardTxns];

  // Find date range to normalize to monthly
  const dates = allTxns.map((t) => new Date(t.date).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const spanDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));
  const spanMonths = Math.max(1, spanDays / 30.44); // average month length

  // Sum debits by category (negative amounts = spending)
  const byCat = new Map<TransactionCategory, { total: number; count: number }>();

  for (const txn of allTxns) {
    if (txn.amount >= 0) continue; // skip credits/deposits
    if (EXCLUDED_CATEGORIES.includes(txn.category)) continue;

    const existing = byCat.get(txn.category) || { total: 0, count: 0 };
    existing.total += Math.abs(txn.amount);
    existing.count += 1;
    byCat.set(txn.category, existing);
  }

  const byCategory: CategoryBreakdown[] = Array.from(byCat.entries())
    .map(([category, { total, count }]) => ({
      category,
      label: CATEGORY_LABELS[category] ?? category,
      monthlyAmount: Math.round(total / spanMonths),
      transactionCount: count,
    }))
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);

  const estimatedMonthlyExpenses = byCategory.reduce(
    (sum, c) => sum + c.monthlyAmount,
    0
  );

  const topCategories = byCategory
    .slice(0, 3)
    .map((c) => c.label.toLowerCase())
    .join(', ');

  return {
    estimatedMonthlyExpenses,
    byCategory,
    explanation: `Based on ${allTxns.length} transactions over ~${Math.round(spanDays)} days. Top spending: ${topCategories}`,
  };
}
