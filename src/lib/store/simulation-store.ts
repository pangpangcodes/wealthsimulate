import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { SimulationResults, SimulationConfig, ScenarioComparison, ScenarioDelta } from '@/lib/types';

interface SimulationState {
  // Current simulation
  currentResults: SimulationResults | null;
  isSimulating: boolean;
  simulationProgress: number;
  error: string | null;

  // History of saved scenarios
  savedScenarios: SimulationResults[];

  // Comparison view
  comparison: ScenarioComparison | null;

  // Post-simulation analysis: results waiting to be sent to Claude
  pendingAnalysis: SimulationResults | null;

  // Chat prompt signal (ephemeral, not persisted)
  pendingChatPrompt: string | null;

  // Simulation modal state
  simulationModalOpen: boolean;
  simulationModalScenarioName: string | null;
  modalAnalysisSummaries: Record<string, string>;

  // Hydration flag
  _hasHydrated: boolean;
  setHasHydrated: (v: boolean) => void;

  // Actions
  setResults: (results: SimulationResults) => void;
  setSimulating: (isSimulating: boolean) => void;
  setProgress: (progress: number) => void;
  setError: (error: string | null) => void;
  setPendingAnalysis: (results: SimulationResults | null) => void;
  setChatPrompt: (prompt: string | null) => void;
  openSimulationModal: (scenarioName: string) => void;
  closeSimulationModal: () => void;
  setModalAnalysisSummary: (scenarioId: string, summary: string) => void;
  saveScenario: (results: SimulationResults) => void;
  removeScenario: (id: string) => void;
  switchToScenario: (id: string) => void;
  reorderScenarios: (reordered: SimulationResults[]) => void;
  compareScenarios: (ids: string[]) => void;
  clearComparison: () => void;
  reset: () => void;
}

export const useSimulationStore = create<SimulationState>()(persist((set, get) => ({
  currentResults: null,
  isSimulating: false,
  simulationProgress: 0,
  error: null,
  savedScenarios: [],
  comparison: null,
  pendingAnalysis: null,
  pendingChatPrompt: null,
  simulationModalOpen: false,
  simulationModalScenarioName: null,
  modalAnalysisSummaries: {},
  _hasHydrated: false,

  setHasHydrated: (v) => set({ _hasHydrated: v }),

  setResults: (results) =>
    set({
      currentResults: results,
      isSimulating: false,
      simulationProgress: 1,
      error: null,
      pendingAnalysis: results,
    }),

  setSimulating: (isSimulating) =>
    set({ isSimulating, simulationProgress: 0, error: null }),

  setProgress: (progress) => set({ simulationProgress: progress }),

  setError: (error) =>
    set({ error, isSimulating: false, simulationProgress: 0 }),

  setPendingAnalysis: (results) => set({ pendingAnalysis: results }),

  setChatPrompt: (prompt) => set({ pendingChatPrompt: prompt }),

  openSimulationModal: (scenarioName) =>
    set({ simulationModalOpen: true, simulationModalScenarioName: scenarioName }),

  closeSimulationModal: () =>
    set({ simulationModalOpen: false, simulationModalScenarioName: null }),

  setModalAnalysisSummary: (scenarioId, summary) =>
    set((state) => ({
      modalAnalysisSummaries: { ...state.modalAnalysisSummaries, [scenarioId]: summary },
    })),

  saveScenario: (results) =>
    set((state) => {
      // Replace if same scenario name exists
      const existing = state.savedScenarios.findIndex(
        (s) => s.scenarioName === results.scenarioName
      );
      const scenarios = [...state.savedScenarios];
      if (existing >= 0) {
        scenarios[existing] = results;
      } else {
        scenarios.push(results);
      }
      return { savedScenarios: scenarios };
    }),

  reorderScenarios: (reordered) => set({ savedScenarios: reordered }),

  removeScenario: (id) =>
    set((state) => {
      const remaining = state.savedScenarios.filter((s) => s.id !== id);
      // If the deleted scenario was active, switch to the baseline or first remaining
      const needsSwitch = state.currentResults?.id === id;
      return {
        savedScenarios: remaining,
        currentResults: needsSwitch
          ? remaining.find((s) => s.scenarioName === 'Current Path') ?? remaining[0] ?? null
          : state.currentResults,
      };
    }),

  switchToScenario: (id) => {
    const state = get();
    const found = state.savedScenarios.find((s) => s.id === id);
    if (found) {
      set({ currentResults: found });
    }
  },

  compareScenarios: (ids) => {
    const state = get();
    const allResults = [
      ...(state.currentResults ? [state.currentResults] : []),
      ...state.savedScenarios,
    ];

    const scenarios = ids
      .map((id) => allResults.find((s) => s.id === id))
      .filter((s): s is SimulationResults => s !== undefined);

    if (scenarios.length < 2) return;

    const base = scenarios[0];
    const deltas: ScenarioDelta[] = [];

    for (let i = 1; i < scenarios.length; i++) {
      const comp = scenarios[i];

      const metrics: { name: string; baseVal: number; compVal: number }[] = [
        {
          name: 'Retirement Annual Income',
          baseVal: base.summary.retirementAnnualIncomeP50,
          compVal: comp.summary.retirementAnnualIncomeP50,
        },
        {
          name: 'Income Replacement Ratio',
          baseVal: base.summary.incomeReplacementRatio,
          compVal: comp.summary.incomeReplacementRatio,
        },
        {
          name: 'Money Lasts To Age',
          baseVal: base.summary.moneyLastsToAge,
          compVal: comp.summary.moneyLastsToAge,
        },
        {
          name: 'Worst Case Net Worth',
          baseVal: base.summary.worstCaseNetWorth,
          compVal: comp.summary.worstCaseNetWorth,
        },
      ];

      for (const m of metrics) {
        const delta = m.compVal - m.baseVal;
        deltas.push({
          metricName: `${m.name} (${comp.scenarioName} vs ${base.scenarioName})`,
          baseValue: m.baseVal,
          comparisonValue: m.compVal,
          delta,
          deltaPercent: m.baseVal !== 0 ? delta / Math.abs(m.baseVal) : 0,
          favoursScenario: delta > 0 ? comp.scenarioName : base.scenarioName,
        });
      }
    }

    set({ comparison: { scenarios, deltas } });
  },

  clearComparison: () => set({ comparison: null }),

  reset: () =>
    set({
      currentResults: null,
      isSimulating: false,
      simulationProgress: 0,
      error: null,
      savedScenarios: [],
      comparison: null,
      pendingAnalysis: null,
      pendingChatPrompt: null,
      simulationModalOpen: false,
      simulationModalScenarioName: null,
      modalAnalysisSummaries: {},
    }),
}), {
  name: 'ws-simulation-v3',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({
    savedScenarios: state.savedScenarios,
    currentResults: state.currentResults,
  }),
  onRehydrateStorage: () => (state) => {
    state?.setHasHydrated(true);
  },
}));
