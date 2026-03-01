'use client';

import type { SimulationResults } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '+';
  const prefix = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${prefix}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${prefix}$${(abs / 1_000).toFixed(0)}K`;
  return `${prefix}$${abs.toFixed(0)}`;
}

function formatDeltaCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value >= 0 ? '+' : '-';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

interface ScenarioMetricCardsProps {
  activeScenario: SimulationResults;
  baseline: SimulationResults | null;
}

export default function ScenarioMetricCards({ activeScenario, baseline }: ScenarioMetricCardsProps) {
  const isBaseline = !baseline || activeScenario.id === baseline.id;

  const retirementAge = activeScenario.config.scenario.retirementAge ?? activeScenario.config.profile.retirementAge;
  const retirementNetWorth = activeScenario.summary.retirementNetWorthP50;
  const moneyLastsToAge = activeScenario.summary.moneyLastsToAge;
  const lifeExpectancy = activeScenario.config.profile.lifeExpectancy;
  const retirementIncome = activeScenario.summary.retirementAnnualIncomeP50;
  const incomeReplacement = activeScenario.summary.incomeReplacementRatio;
  const incomeTarget = activeScenario.summary.incomeReplacementTarget ?? activeScenario.config.profile.annualIncome;

  // Baseline deltas
  const baselineNetWorth = baseline?.summary.retirementNetWorthP50 ?? 0;
  const netWorthDelta = retirementNetWorth - baselineNetWorth;
  const baselineMoneyLasts = baseline?.summary.moneyLastsToAge ?? 0;
  const moneyLastsDelta = moneyLastsToAge - baselineMoneyLasts;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={activeScenario.id}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.25 }}
        className="grid grid-cols-3 gap-3 mt-4"
      >
        {/* Card 1: Net Worth at Retirement */}
        <div className="bg-ws-bg rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-ws-text-tertiary mb-1">
            Net worth at {retirementAge}
          </p>
          <p className="text-lg font-semibold text-ws-text">
            {formatCurrency(retirementNetWorth)}
          </p>
          {!isBaseline && (
            <p className={`text-xs mt-0.5 ${netWorthDelta >= 0 ? 'text-ws-green' : 'text-ws-red'}`}>
              {formatDeltaCurrency(netWorthDelta)} vs baseline
            </p>
          )}
        </div>

        {/* Card 2: Money Lasts To */}
        <div className="bg-ws-bg rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-ws-text-tertiary mb-1">
            Money lasts to
          </p>
          <p className="text-lg font-semibold text-ws-text">
            {moneyLastsToAge >= lifeExpectancy ? `${lifeExpectancy}+` : `Age ${moneyLastsToAge}`}
          </p>
          {!isBaseline && moneyLastsDelta !== 0 && (
            <p className={`text-xs mt-0.5 ${moneyLastsDelta > 0 ? 'text-ws-green' : 'text-ws-red'}`}>
              {moneyLastsDelta > 0 ? '+' : ''}{moneyLastsDelta} yrs vs baseline
            </p>
          )}
        </div>

        {/* Card 3: Retirement Income */}
        <div className="bg-ws-bg rounded-lg px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-ws-text-tertiary mb-1">
            Retirement income
          </p>
          <p className="text-lg font-semibold text-ws-text">
            {formatCurrency(retirementIncome)}/yr
          </p>
          <p className={`text-xs mt-0.5 ${
            incomeReplacement >= 0.7 ? 'text-ws-green' : incomeReplacement >= 0.5 ? 'text-amber-600' : 'text-ws-red'
          }`}>
            {Math.round(incomeReplacement * 100)}% of {formatCurrency(incomeTarget)} income
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
