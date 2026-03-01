'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProfileStore } from '@/lib/store/profile-store';
import { deriveMonthlyExpenses } from '@/lib/analysis/expense-detection';
import { useSimulationStore } from '@/lib/store/simulation-store';
import { useSimulation } from '@/lib/hooks/useSimulation';
import type { ScenarioOverrides } from '@/lib/types';
import NetWorthTimeline from '@/components/dashboard/NetWorthTimeline';
import PortfolioBreakdown from '@/components/dashboard/PortfolioBreakdown';
import AccountsList from '@/components/dashboard/AccountsList';
import ScenarioCompare from '@/components/dashboard/ScenarioCompare';
import ScenarioMetricCards from '@/components/dashboard/ScenarioMetricCards';
import ChatBubble from '@/components/chat/ChatBubble';
import SimulationPanel from '@/components/simulation/SimulationModal';
import { AnimatePresence, motion } from 'framer-motion';
import { TrendingUp, ArrowLeft, Info, X, Sparkles } from 'lucide-react';
import ProactiveInsights from '@/components/dashboard/ProactiveInsights';
import CoPilotPanel from '@/components/chat/CoPilotPanel';
import { detectBiweeklyIncome } from '@/lib/analysis/income-detection';
import { calculateGovernmentPensionsAtAge65 } from '@/lib/simulation/government-pensions';
import Link from 'next/link';

export default function SimulatorPage() {
  const profile = useProfileStore((s) => s.profile);
  const updateField = useProfileStore((s) => s.updateField);
  const { simulate, currentResults, isSimulating, savedScenarios } = useSimulation();
  const openSimulationModal = useSimulationStore((s) => s.openSimulationModal);
  const simulationModalOpen = useSimulationStore((s) => s.simulationModalOpen);
  const closeSimulationModal = useSimulationStore((s) => s.closeSimulationModal);
  const setChatPrompt = useSimulationStore((s) => s.setChatPrompt);
  const hasHydrated = useSimulationStore((s) => s._hasHydrated);

  // Always start on the dashboard when navigating to /simulator
  useEffect(() => {
    closeSimulationModal();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Active scenario tracking for the unified chart + metric cards
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);

  const allScenarios = useMemo(
    () => savedScenarios.length > 0 ? savedScenarios : currentResults ? [currentResults] : [],
    [savedScenarios, currentResults]
  );
  const baseline = useMemo(
    () => allScenarios.find((s) => s.scenarioName === 'Current Path') ?? null,
    [allScenarios]
  );
  const activeScenario = useMemo(
    () => allScenarios.find((s) => s.id === activeScenarioId) ?? currentResults ?? null,
    [allScenarios, activeScenarioId, currentResults]
  );

  // Auto-select latest scenario when a new simulation completes
  useEffect(() => {
    if (currentResults) setActiveScenarioId(currentResults.id);
  }, [currentResults?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repair: derive monthlyExpenses from transactions if still 0
  const hasBankingTxns = useMemo(() =>
    profile.accounts.some(
      (a) => (a.type === 'chequing' || a.type === 'credit-card') && a.transactions && a.transactions.length > 0
    ), [profile.accounts]);
  const awaitingExpenseRepair = profile.monthlyExpenses === 0 && hasBankingTxns;
  const expenseWasRepaired = useRef(false);

  useEffect(() => {
    if (!awaitingExpenseRepair) return;
    const chequing = profile.accounts.find((a) => a.type === 'chequing');
    const creditCard = profile.accounts.find((a) => a.type === 'credit-card');
    const { estimatedMonthlyExpenses } = deriveMonthlyExpenses(
      chequing?.transactions ?? [],
      creditCard?.transactions ?? []
    );
    if (estimatedMonthlyExpenses > 0) {
      updateField('monthlyExpenses', estimatedMonthlyExpenses);
      expenseWasRepaired.current = true;
    }
  }, [awaitingExpenseRepair]); // eslint-disable-line react-hooks/exhaustive-deps

  // Insight modal (Income / Expenses / Retirement)
  const [insightModal, setInsightModal] = useState<'income' | 'expenses' | 'retirement' | null>(null);

  // Income detection insight
  const incomeInsight = useMemo(() => {
    const chequing = profile.accounts.find((a) => a.type === 'chequing');
    if (!chequing?.transactions) return null;
    return detectBiweeklyIncome(chequing.transactions);
  }, [profile.accounts]);

  // Expense category breakdown
  const expenseInsight = useMemo(() => {
    const chequing = profile.accounts.find((a) => a.type === 'chequing');
    const creditCard = profile.accounts.find((a) => a.type === 'credit-card');
    const chequingTxns = chequing?.transactions ?? [];
    const ccTxns = creditCard?.transactions ?? [];
    if (chequingTxns.length === 0 && ccTxns.length === 0) return null;
    return deriveMonthlyExpenses(chequingTxns, ccTxns);
  }, [profile.accounts]);

  const sortedCategories = useMemo(() => {
    if (!expenseInsight) return [];
    const cats = [...expenseInsight.byCategory].filter((c) => c.monthlyAmount > 0);
    cats.sort((a, b) => {
      if (a.category === 'other') return 1;
      if (b.category === 'other') return -1;
      return b.monthlyAmount - a.monthlyAmount;
    });
    return cats.slice(0, 6);
  }, [expenseInsight]);

  // Government pension estimates
  const govPensions = useMemo(
    () => calculateGovernmentPensionsAtAge65(profile.cppBenefitRate ?? 0.65),
    [profile.cppBenefitRate]
  );

  // Profile insights
  const yearsToRetirement = profile.retirementAge - profile.age;
  const savingsRatePct = Math.round(profile.annualSavingsRate * 100);
  const annualSavings = profile.annualIncome * profile.annualSavingsRate;
  const annualExpenses = profile.monthlyExpenses * 12;

  const currentRetirementTarget = profile.desiredRetirementIncome ?? annualExpenses;

  // Always re-run baseline simulation on mount with the latest profile data.
  // This ensures any changes made in the review/onboarding flow are reflected,
  // even if stale results exist in sessionStorage from a previous run.
  // Also waits for expense repair to complete before running.
  useEffect(() => {
    if (!hasHydrated) return;
    if (awaitingExpenseRepair) return;
    if (!isSimulating) {
      simulate({ name: 'Current Path' });
      // If expense repair just fired, all saved scenarios have $0-expense results.
      // Re-run them so they reflect the repaired profile.
      if (expenseWasRepaired.current) {
        expenseWasRepaired.current = false;
        for (const s of savedScenarios) {
          if (s.scenarioName !== 'Current Path') {
            simulate({ ...s.config.scenario, name: s.scenarioName });
          }
        }
      }
    }
  }, [hasHydrated, awaitingExpenseRepair]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSimulationRequest = useCallback(
    (scenario: ScenarioOverrides) => {
      openSimulationModal(scenario.name);
      simulate(scenario);
    },
    [simulate, openSimulationModal]
  );

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-ws-bg">
      {/* Nav - Wealthsimple style */}
      <nav className="border-b border-ws-border bg-white flex-shrink-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-7 h-7 bg-ws-black rounded-md flex items-center justify-center">
                <TrendingUp size={14} className="text-white" />
              </div>
            </Link>
            <div className="flex items-center gap-6 text-base">
              <span className="font-medium text-ws-text border-b-2 border-ws-black pb-2.5 -mb-[13px]">
                Home
              </span>
              <span className="text-ws-text-secondary hover:text-ws-text cursor-pointer transition-colors pb-2.5 -mb-[13px]">
                Activity
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-ws-text-secondary hover:text-ws-text transition-colors"
            >
              <ArrowLeft size={12} />
              Back
            </Link>
          </div>
        </div>
      </nav>

      <main className="flex-1 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 h-full">
          {/* Main grid - co-pilot layout: content left, persistent chat right */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-full">
            {/* Left column - scrollable content */}
            <div className="lg:col-span-3 overflow-y-auto py-8 space-y-6 scrollbar-hide">
              {simulationModalOpen ? (
                <SimulationPanel />
              ) : (
              <>
              {/* Profile header */}
              <div>
                <h1 className="text-xl font-semibold text-ws-text">Hello Alex</h1>
                <Link
                  href="/review"
                  className="text-sm text-ws-green hover:text-ws-green/80 transition-colors"
                >
                  Review your info
                </Link>
              </div>
            {/* Profile cards */}
            <div className="grid grid-cols-4 gap-3">
                {/* Age */}
                <div className="bg-white rounded-xl border border-ws-border px-4 py-3">
                  <p className="text-xs text-ws-text-tertiary mb-1">Age</p>
                  <p className="text-xl font-light text-ws-text">{profile.age}</p>
                </div>

                {/* Income - clickable insight */}
                <div className="bg-white rounded-xl border border-ws-border px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs text-ws-text-tertiary">Income</p>
                    <button type="button" onClick={() => setInsightModal('income')} className="text-ws-text-tertiary/60 hover:text-ws-text-secondary transition-colors">
                      <Info size={12} />
                    </button>
                  </div>
                  <p className="text-xl font-light text-ws-text">${(profile.annualIncome / 1000).toFixed(0)}K</p>
                  <button
                    type="button"
                    onClick={() => setChatPrompt('What if I saved more?')}
                    className="mt-1.5 text-xs text-ws-green hover:text-ws-green/80 transition-colors text-left"
                  >
                    + What if I saved more?
                  </button>
                </div>

                {/* Expenses - clickable insight */}
                <div className="bg-white rounded-xl border border-ws-border px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs text-ws-text-tertiary">Expenses</p>
                    <button type="button" onClick={() => setInsightModal('expenses')} className="text-ws-text-tertiary/60 hover:text-ws-text-secondary transition-colors">
                      <Info size={12} />
                    </button>
                  </div>
                  <p className="text-xl font-light text-ws-text">${profile.monthlyExpenses.toLocaleString()}/mo</p>
                  <button
                    type="button"
                    onClick={() => setChatPrompt('What if I need less in retirement?')}
                    className="mt-1.5 text-xs text-ws-green hover:text-ws-green/80 transition-colors text-left"
                  >
                    + What if I need less in retirement?
                  </button>
                </div>

                {/* Retirement Age */}
                <div className="bg-white rounded-xl border border-ws-border px-4 py-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <p className="text-xs text-ws-text-tertiary">Retire at</p>
                    <button type="button" onClick={() => setInsightModal('retirement')} className="text-ws-text-tertiary/60 hover:text-ws-text-secondary transition-colors">
                      <Info size={12} />
                    </button>
                  </div>
                  <p className="text-xl font-light text-ws-text">{profile.retirementAge}</p>
                  <button
                    type="button"
                    onClick={() => setChatPrompt('What if I retire earlier?')}
                    className="mt-1.5 text-xs text-ws-green hover:text-ws-green/80 transition-colors text-left"
                  >
                    + What if I retire earlier?
                  </button>
                </div>
              </div>
            {/* Proactive AI Insights - always based on current path only */}
            {baseline && (
              <ProactiveInsights
                results={baseline}
                baseline={baseline}
                profile={profile}
              />
            )}

            {/* Unified scenario chart card */}
            <div className="bg-white rounded-xl border border-ws-border p-6">
              <ScenarioCompare
                activeScenarioId={activeScenarioId}
                onActiveChange={setActiveScenarioId}
              />
              <div className="mt-4">
                <NetWorthTimeline
                  scenarios={allScenarios}
                  activeScenarioId={activeScenarioId}
                  onActiveChange={setActiveScenarioId}
                  isSimulating={isSimulating}
                  hideLegend
                />
              </div>
              {activeScenario && (
                <ScenarioMetricCards
                  activeScenario={activeScenario}
                  baseline={baseline}
                />
              )}
            </div>

            {/* Portfolio allocation */}
            <PortfolioBreakdown />

            {/* Accounts */}
            <AccountsList />

            {/* Disclaimer */}
            <p className="text-xs text-ws-text-tertiary">
              Not financial advice. Simulated outcomes based on historical patterns and simplified tax rules.
            </p>
              </>
              )}
          </div>

            {/* Right column - persistent co-pilot chat */}
            <div className="hidden lg:flex lg:col-span-2 pt-3 pb-3 min-h-0 overflow-hidden">
              <CoPilotPanel onSimulationRequest={handleSimulationRequest} />
            </div>
          </div>
        </div>
      </main>

      {/* Chat bubble - fixed bottom right */}
      <ChatBubble onSimulationRequest={handleSimulationRequest} />


      {/* Income / Expenses insight modal */}
      <AnimatePresence>
        {insightModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
              onClick={() => setInsightModal(null)}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-x-0 bottom-0 z-50 flex justify-center items-end pb-6 px-4 pointer-events-none sm:inset-0 sm:items-center sm:pb-0"
            >
              <div className="bg-white rounded-2xl border border-ws-border shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden pointer-events-auto">
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-ws-border flex-shrink-0">
                  <h2 className="text-sm font-semibold text-ws-text">
                    {insightModal === 'income' ? 'How we estimated your income' : insightModal === 'expenses' ? 'How we estimated your expenses' : 'Your retirement plan'}
                  </h2>
                  <button
                    onClick={() => setInsightModal(null)}
                    className="p-1.5 rounded-lg text-ws-text-tertiary hover:text-ws-text hover:bg-ws-hover transition-colors -mt-0.5"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
                  {insightModal === 'income' && (
                    <>
                      {incomeInsight ? (
                        <div className="bg-ws-green-light rounded-xl p-4 flex items-start gap-3">
                          <Sparkles size={16} className="text-ws-green mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-ws-text">
                              We detected biweekly deposits of ~${incomeInsight.biweeklyAmount.toLocaleString()}
                            </p>
                            <p className="text-xs text-ws-text-secondary mt-0.5">
                              {incomeInsight.explanation}. Estimated gross annual income: ~${incomeInsight.estimatedAnnualIncome.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-ws-bg rounded-xl p-4">
                          <p className="text-sm text-ws-text-secondary">
                            No deposit pattern detected. Your income was entered manually.
                          </p>
                        </div>
                      )}

                      <div className="bg-white rounded-xl border border-ws-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Annual Income (Gross)</span>
                          <span className="text-sm font-medium text-ws-text">${profile.annualIncome.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Savings Rate</span>
                          <span className="text-sm font-medium text-ws-text">{savingsRatePct}%</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Annual Savings</span>
                          <span className="text-sm font-medium text-ws-text">${annualSavings.toLocaleString()}/yr</span>
                        </div>
                        {incomeInsight && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-ws-text-secondary">Detection Confidence</span>
                            <span className="text-sm font-medium text-ws-text capitalize">{incomeInsight.confidence}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-center pt-2">
                        <Link
                          href="/review"
                          onClick={() => setInsightModal(null)}
                          className="text-sm text-ws-green hover:text-ws-green/80 transition-colors"
                        >
                          Edit in Review
                        </Link>
                      </div>
                    </>
                  )}

                  {insightModal === 'expenses' && (
                    <>
                      {expenseInsight ? (
                        <div className="bg-ws-green-light rounded-xl p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <Sparkles size={16} className="text-ws-green mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium text-ws-text">
                                Estimated ~${expenseInsight.estimatedMonthlyExpenses.toLocaleString()}/mo from your transactions
                              </p>
                              <p className="text-xs text-ws-text-secondary mt-0.5">
                                {expenseInsight.explanation}
                              </p>
                            </div>
                          </div>

                          {sortedCategories.length > 0 && (
                            <div className="grid grid-cols-2 gap-1.5">
                              {sortedCategories.map((cat) => (
                                <div key={cat.category} className="flex items-center justify-between text-xs px-2 py-1.5 bg-white/60 rounded-lg">
                                  <span className="text-ws-text-secondary">{cat.label}</span>
                                  <span className="font-medium text-ws-text">${cat.monthlyAmount.toLocaleString()}/mo</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="bg-ws-bg rounded-xl p-4">
                          <p className="text-sm text-ws-text-secondary">
                            No transaction data available. Your expenses were entered manually.
                          </p>
                        </div>
                      )}

                      <div className="bg-white rounded-xl border border-ws-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Monthly Expenses</span>
                          <span className="text-sm font-medium text-ws-text">${profile.monthlyExpenses.toLocaleString()}/mo</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Annual Expenses</span>
                          <span className="text-sm font-medium text-ws-text">${annualExpenses.toLocaleString()}/yr</span>
                        </div>
                      </div>

                      <div className="text-center pt-2">
                        <Link
                          href="/review"
                          onClick={() => setInsightModal(null)}
                          className="text-sm text-ws-green hover:text-ws-green/80 transition-colors"
                        >
                          Edit in Review
                        </Link>
                      </div>
                    </>
                  )}

                  {insightModal === 'retirement' && (
                    <>
                      {/* Government benefits summary */}
                      <div className="bg-ws-green-light rounded-xl p-4">
                        <div className="flex items-start gap-3 mb-3">
                          <Sparkles size={16} className="text-ws-green mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-ws-text">
                              ~${Math.round(govPensions.total / 12).toLocaleString()}/mo in government benefits at 65
                            </p>
                            <p className="text-xs text-ws-text-secondary mt-0.5">
                              Estimated based on a median earner. Amounts are in today's dollars and indexed to inflation.
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-xs px-2 py-1.5 bg-white/60 rounded-lg">
                            <span className="text-ws-text-secondary">CPP (Canada Pension Plan)</span>
                            <span className="font-medium text-ws-text">${Math.round(govPensions.cpp / 12).toLocaleString()}/mo</span>
                          </div>
                          <div className="flex items-center justify-between text-xs px-2 py-1.5 bg-white/60 rounded-lg">
                            <span className="text-ws-text-secondary">OAS (Old Age Security)</span>
                            <span className="font-medium text-ws-text">${Math.round(govPensions.oas / 12).toLocaleString()}/mo</span>
                          </div>
                          {govPensions.gis > 0 && (
                            <div className="flex items-center justify-between text-xs px-2 py-1.5 bg-white/60 rounded-lg">
                              <span className="text-ws-text-secondary">GIS (Guaranteed Income Supplement)</span>
                              <span className="font-medium text-ws-text">${Math.round(govPensions.gis / 12).toLocaleString()}/mo</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Retirement details */}
                      <div className="bg-white rounded-xl border border-ws-border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Retirement Age</span>
                          <span className="text-sm font-medium text-ws-text">{profile.retirementAge}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Years to Retirement</span>
                          <span className="text-sm font-medium text-ws-text">{yearsToRetirement}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Retirement Income Target</span>
                          <span className="text-sm font-medium text-ws-text">${currentRetirementTarget.toLocaleString()}/yr</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-ws-text-secondary">Life Expectancy</span>
                          <span className="text-sm font-medium text-ws-text">Age {profile.lifeExpectancy}</span>
                        </div>
                      </div>

                      {/* CPP timing note */}
                      <div className="bg-ws-bg rounded-xl p-4">
                        <p className="text-xs text-ws-text-secondary leading-relaxed">
                          CPP can start as early as 60 (reduced 7.2%/yr) or as late as 70 (increased 8.4%/yr).
                          OAS begins at 65. These estimates assume you start both at 65.
                        </p>
                      </div>

                      <div className="text-center pt-2">
                        <Link
                          href="/review"
                          onClick={() => setInsightModal(null)}
                          className="text-sm text-ws-green hover:text-ws-green/80 transition-colors"
                        >
                          Edit in Review
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
