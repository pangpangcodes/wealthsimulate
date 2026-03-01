import type { Transaction } from '@/lib/types';

export interface IncomeDetectionResult {
  estimatedAnnualIncome: number;
  biweeklyAmount: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
}

/**
 * Detects biweekly income from recurring deposit patterns.
 * Looks for deposits of similar amounts ~14 days apart.
 */
export function detectBiweeklyIncome(
  transactions: Transaction[]
): IncomeDetectionResult | null {
  // Filter to income/deposit transactions (positive amounts)
  const deposits = transactions
    .filter((t) => t.amount > 0 && t.category === 'income')
    .sort((a, b) => a.date.localeCompare(b.date));

  if (deposits.length < 2) return null;

  // Group deposits by similar amounts (within 5% tolerance)
  const groups: Transaction[][] = [];
  for (const deposit of deposits) {
    let placed = false;
    for (const group of groups) {
      const refAmount = group[0].amount;
      if (Math.abs(deposit.amount - refAmount) / refAmount < 0.05) {
        group.push(deposit);
        placed = true;
        break;
      }
    }
    if (!placed) {
      groups.push([deposit]);
    }
  }

  // Find the largest group with at least 2 deposits
  const bestGroup = groups
    .filter((g) => g.length >= 2)
    .sort((a, b) => b.length - a.length)[0];

  if (!bestGroup) return null;

  // Check interval is approximately biweekly (10-18 days)
  const intervals: number[] = [];
  for (let i = 1; i < bestGroup.length; i++) {
    const d1 = new Date(bestGroup[i - 1].date);
    const d2 = new Date(bestGroup[i].date);
    const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    intervals.push(days);
  }

  const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  const isBiweekly = avgInterval >= 10 && avgInterval <= 18;

  if (!isBiweekly) return null;

  const biweeklyAmount = Math.round(
    bestGroup.reduce((sum, t) => sum + t.amount, 0) / bestGroup.length
  );

  // Estimate annual: 26 biweekly periods, gross up from net
  const annualNet = biweeklyAmount * 26;
  // Tiered gross-up based on net income level (taxes + CPP + EI deductions vary by bracket)
  // ~$30K net → ~22% deducted (low bracket, ON) → factor 0.78
  // ~$45-65K net → ~29% deducted (mid bracket, ON) → factor 0.71
  // ~$75K+ net → ~33% deducted (upper bracket, ON) → factor 0.67
  const grossUpFactor = annualNet < 35000 ? 0.78
    : annualNet < 55000 ? 0.74
    : annualNet < 75000 ? 0.71
    : 0.67;
  const estimatedGross = Math.round(annualNet / grossUpFactor / 1000) * 1000;

  const confidence: IncomeDetectionResult['confidence'] =
    bestGroup.length >= 4 ? 'high' : bestGroup.length >= 3 ? 'medium' : 'low';

  return {
    estimatedAnnualIncome: estimatedGross,
    biweeklyAmount,
    confidence,
    explanation: `Detected ${bestGroup.length} deposits of ~$${biweeklyAmount.toLocaleString()} every ~${Math.round(avgInterval)} days`,
  };
}
