'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useSimulationStore } from '@/lib/store/simulation-store';
import NetWorthTimeline from '@/components/dashboard/NetWorthTimeline';
import SimulationBreakdown from '@/components/simulation/SimulationBreakdown';
import SensitivityChart from '@/components/simulation/SensitivityChart';
import { generateInsights, generateVerdict } from '@/lib/simulation/insights';
import { runSensitivityAnalysis, type SensitivityResult } from '@/lib/simulation/sensitivity';

function renderInlineMd(s: string): string {
  s = s.replace(/\u2014/g, ' - ').replace(/\u2013/g, ' - ');
  s = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');
  return s;
}

function formatCurrency(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function formatMonthly(annualValue: number): string {
  const monthly = annualValue / 12;
  const abs = Math.abs(monthly);
  const sign = monthly < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M/mo`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K/mo`;
  return `${sign}$${abs.toFixed(0)}/mo`;
}

export default function SimulationPanel() {
  const simulationModalOpen = useSimulationStore((s) => s.simulationModalOpen);
  const closeSimulationModal = useSimulationStore((s) => s.closeSimulationModal);
  const isSimulating = useSimulationStore((s) => s.isSimulating);
  const simulationProgress = useSimulationStore((s) => s.simulationProgress);
  const currentResults = useSimulationStore((s) => s.currentResults);
  const savedScenarios = useSimulationStore((s) => s.savedScenarios);
  const switchToScenario = useSimulationStore((s) => s.switchToScenario);
  const simulationModalScenarioName = useSimulationStore((s) => s.simulationModalScenarioName);
  const modalAnalysisSummaries = useSimulationStore((s) => s.modalAnalysisSummaries);
  const setPendingAnalysis = useSimulationStore((s) => s.setPendingAnalysis);
  const setChatPrompt = useSimulationStore((s) => s.setChatPrompt);

  const analysisRequestedForRef = useRef<Set<string>>(new Set());
  const [sensitivityResult, setSensitivityResult] = useState<SensitivityResult | null>(null);
  const sensitivityComputedForId = useRef<string | null>(null);

  // Run sensitivity analysis when the panel opens with results
  useEffect(() => {
    if (!simulationModalOpen || isSimulating || !currentResults) return;
    if (sensitivityComputedForId.current === currentResults.id) return;
    sensitivityComputedForId.current = currentResults.id;
    setSensitivityResult(null);
    setTimeout(() => {
      try {
        const result = runSensitivityAnalysis(
          currentResults.config.profile,
          currentResults.config.scenario,
          100
        );
        setSensitivityResult(result);
      } catch {
        // Sensitivity is optional
      }
    }, 50);
  }, [simulationModalOpen, isSimulating, currentResults]);

  // Reset when panel closes
  useEffect(() => {
    if (!simulationModalOpen) {
      sensitivityComputedForId.current = null;
      setSensitivityResult(null);
    }
  }, [simulationModalOpen]);

  // Filter sensitivity variables to what's relevant for this scenario
  const filteredSensitivity = useMemo(() => {
    if (!sensitivityResult || !currentResults) return null;
    const scenario = currentResults.config.scenario;
    const relevantVars = new Set<string>();
    if (scenario.retirementAge !== undefined) relevantVars.add('retirement_age');
    if (scenario.annualSavingsRate !== undefined) relevantVars.add('savings_rate');
    if (scenario.inflationRate !== undefined) {
      relevantVars.add('inflation');
      relevantVars.add('expected_returns');
    }
    if (scenario.lifeExpectancy !== undefined) relevantVars.add('life_expectancy');
    if (scenario.marketCrash) relevantVars.add('expected_returns');
    if (scenario.additionalIncome !== undefined) relevantVars.add('savings_rate');
    if (scenario.careerChange) relevantVars.add('savings_rate');

    if (relevantVars.size === 0) return sensitivityResult;

    return {
      ...sensitivityResult,
      variables: sensitivityResult.variables.filter((v) => relevantVars.has(v.name)),
    };
  }, [sensitivityResult, currentResults]);

  const analysisSummary = currentResults
    ? modalAnalysisSummaries[currentResults.id] ?? null
    : null;

  // When panel is open with results but no AI summary, trigger analysis
  useEffect(() => {
    if (
      simulationModalOpen &&
      !isSimulating &&
      currentResults &&
      !analysisSummary
    ) {
      if (!analysisRequestedForRef.current.has(currentResults.id)) {
        analysisRequestedForRef.current.add(currentResults.id);
        setPendingAnalysis(currentResults);
      }
    }
  }, [simulationModalOpen, isSimulating, currentResults, analysisSummary, setPendingAnalysis]);

  const showLoading = isSimulating;
  const showResults = !isSimulating && currentResults;

  const scenarioName = currentResults?.scenarioName ?? simulationModalScenarioName ?? 'Simulation';
  const retirementIncomeP50 = currentResults?.summary.retirementAnnualIncomeP50 ?? 0;
  const incomeReplacement = currentResults?.summary.incomeReplacementRatio ?? 0;
  const incomeTarget = currentResults?.summary.incomeReplacementTarget ?? currentResults?.config.profile.annualIncome ?? 0;
  const moneyLastsToAge = currentResults?.summary.moneyLastsToAge ?? 0;
  const lifeExpectancy = currentResults?.config.profile.lifeExpectancy ?? 90;
  const retirementAge = currentResults?.config.scenario.retirementAge ?? currentResults?.config.profile.retirementAge ?? 65;
  const currentAge = currentResults?.config.profile.age ?? 30;
  const retirementNetWorthP50 = currentResults?.summary.retirementNetWorthP50 ?? 0;
  const validPaths = currentResults?.validPaths ?? 1000;

  // Baseline comparison
  const baseline = savedScenarios.find((s) => s.scenarioName === 'Current Path');
  const isBaseline = !currentResults || !baseline || currentResults.id === baseline.id;
  const moneyLastsDelta = !isBaseline
    ? (currentResults!.summary.moneyLastsToAge - baseline!.summary.moneyLastsToAge)
    : null;
  const netWorthDelta = !isBaseline
    ? (currentResults!.summary.retirementNetWorthP50 - baseline!.summary.retirementNetWorthP50)
    : null;

  const progressPercent = Math.round(simulationProgress * 100);

  // Verdict
  const verdict = currentResults ? generateVerdict(currentResults) : null;

  // Show tabs when there are 2+ saved scenarios
  const showTabs = savedScenarios.length > 1;

  // Verdict colour classes
  const verdictBg = verdict?.severity === 'green'
    ? 'bg-ws-green-light'
    : verdict?.severity === 'amber'
      ? 'bg-[var(--color-ws-yellow-light)]'
      : 'bg-ws-red-light';
  const verdictText = verdict?.severity === 'green'
    ? 'text-ws-green'
    : verdict?.severity === 'amber'
      ? 'text-amber-600'
      : 'text-ws-red';

  if (!simulationModalOpen) return null;

  return (
    <>
      {/* Back button + scenario name */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={closeSimulationModal}
          className="flex items-center gap-1.5 text-sm text-ws-text-secondary hover:text-ws-text transition-colors"
        >
          <ArrowLeft size={14} />
          Back
        </button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-ws-text truncate">{scenarioName}</h1>
          {showLoading && (
            <p className="text-xs text-ws-text-secondary mt-0.5">Running simulation...</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-ws-border p-6 space-y-4">
      {/* Scenario tabs */}
      {showTabs && (
        <div className="flex flex-wrap gap-1">
          {savedScenarios.map((scenario) => {
            const isActive = currentResults?.id === scenario.id;
            return (
              <button
                key={scenario.id}
                onClick={() => switchToScenario(scenario.id)}
                disabled={isSimulating}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors disabled:opacity-40 ${
                  isActive
                    ? 'bg-ws-black text-white'
                    : 'bg-ws-bg text-ws-text hover:bg-ws-hover'
                }`}
              >
                {scenario.scenarioName}
              </button>
            );
          })}
        </div>
      )}

      {/* Loading state */}
      {showLoading && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Loader2 size={28} className="text-ws-green animate-spin" />
          <p className="text-sm text-ws-text">
            Exploring {validPaths.toLocaleString()} possible futures...
          </p>
          <div className="w-48 flex items-center gap-3">
            <div className="flex-1 h-1.5 bg-ws-border rounded-full overflow-hidden">
              <div
                className="h-full bg-ws-green rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs text-ws-text-secondary w-8 text-right">{progressPercent}%</span>
          </div>
        </div>
      )}

      {/* Results */}
      {showResults && (
        <div className="space-y-4">
          {/* Verdict banner */}
          {verdict && (
            analysisSummary ? (
              <div className={`rounded-lg px-4 py-3 ${verdictBg}`}>
                <p className={`text-sm font-semibold ${verdictText}`}>{verdict.message}</p>
                <p className="text-xs text-ws-text mt-1 leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInlineMd(analysisSummary) }} />
                {verdict.chatPrompt && (
                  <button
                    className="text-xs mt-2 underline underline-offset-2 text-ws-green"
                    onClick={() => { setChatPrompt(verdict.chatPrompt!); }}
                  >
                    Ask what you can do &rarr;
                  </button>
                )}
              </div>
            ) : (
              <div className="rounded-lg px-4 py-3 bg-ws-bg">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="text-ws-text-tertiary animate-spin" />
                  <p className="text-sm text-ws-text-secondary">Analyzing your scenario...</p>
                </div>
              </div>
            )
          )}

          {/* Metric cards - 3 columns */}
          <div className="grid grid-cols-3 gap-2.5">
            {/* Money Lasts To */}
            <div className="bg-ws-bg rounded-lg px-3 py-3 text-center">
              <p className={`text-sm font-semibold ${moneyLastsToAge >= lifeExpectancy ? 'text-ws-green' : moneyLastsToAge >= lifeExpectancy - 5 ? 'text-amber-600' : 'text-ws-red'}`}>
                {moneyLastsToAge >= lifeExpectancy ? `Age ${lifeExpectancy}+` : `Age ${moneyLastsToAge}`}
              </p>
              <p className="text-[10px] text-ws-text-secondary mt-0.5">Money Lasts To</p>
              {moneyLastsDelta !== null && (
                <p className={`text-[10px] mt-0.5 ${moneyLastsDelta >= 0 ? 'text-ws-green' : 'text-ws-red'}`}>
                  {moneyLastsDelta >= 0 ? '+' : ''}{moneyLastsDelta} yrs vs baseline
                </p>
              )}
            </div>

            {/* At Retirement */}
            <div className="bg-ws-bg rounded-lg px-3 py-3 text-center">
              <p className="text-sm font-semibold text-ws-text">{formatCurrency(retirementNetWorthP50)}</p>
              <p className="text-[10px] text-ws-text-secondary mt-0.5">At Retirement</p>
              {netWorthDelta !== null && (
                <p className={`text-[10px] mt-0.5 ${netWorthDelta >= 0 ? 'text-ws-green' : 'text-ws-red'}`}>
                  {netWorthDelta >= 0 ? '+' : ''}{formatCurrency(netWorthDelta)} vs baseline
                </p>
              )}
            </div>

            {/* Retirement Income */}
            <div className="bg-ws-bg rounded-lg px-3 py-3 text-center">
              <p className="text-sm font-semibold text-ws-text">{formatMonthly(retirementIncomeP50)}</p>
              <p className="text-[10px] text-ws-text-secondary mt-0.5">Retirement Income</p>
              <p className="text-[10px] text-ws-text-secondary mt-0.5">
                {(incomeReplacement * 100).toFixed(0)}% of {formatCurrency(incomeTarget)} income
              </p>
            </div>
          </div>

          {/* Chart */}
          <NetWorthTimeline results={currentResults} compact />

          {/* Math breakdown */}
          <SimulationBreakdown
            insights={generateInsights(currentResults)}
            currentAge={currentAge}
            retirementAge={retirementAge}
            lifeExpectancy={lifeExpectancy}
          />

          {/* Sensitivity - what moves the needle */}
          {filteredSensitivity && filteredSensitivity.variables.length > 0 && (
            <SensitivityChart result={filteredSensitivity} />
          )}

          {/* Footer disclaimer */}
          <p className="text-[10px] text-ws-text-secondary text-center pt-2">
            AI-generated. Not financial advice.
          </p>
        </div>
      )}
      </div>
    </>
  );
}
