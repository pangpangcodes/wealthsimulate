'use client';

import { useMemo } from 'react';
import { useSimulationStore } from '@/lib/store/simulation-store';
import { X, Plus, Expand } from 'lucide-react';
import { POSITIVE_COLOURS, NEGATIVE_COLOURS, BASELINE_COLOUR } from '@/components/dashboard/NetWorthTimeline';

interface ScenarioCompareProps {
  activeScenarioId: string | null;
  onActiveChange: (id: string) => void;
}

export default function ScenarioCompare({ activeScenarioId, onActiveChange }: ScenarioCompareProps) {
  const savedScenarios = useSimulationStore((s) => s.savedScenarios);
  const currentResults = useSimulationStore((s) => s.currentResults);
  const removeScenario = useSimulationStore((s) => s.removeScenario);
  const setChatPrompt = useSimulationStore((s) => s.setChatPrompt);
  const openSimulationModal = useSimulationStore((s) => s.openSimulationModal);
  const switchToScenario = useSimulationStore((s) => s.switchToScenario);

  const scenarios = savedScenarios.length > 0 ? savedScenarios : currentResults ? [currentResults] : [];

  // Assign colours using the same logic as NetWorthTimeline
  const colourMap = useMemo(() => {
    const map = new Map<string, string>();
    const baselineNW = scenarios.find((s) => s.scenarioName === 'Current Path')
      ?.summary.retirementNetWorthP50 ?? 0;
    let posIdx = 0;
    let negIdx = 0;
    for (const s of scenarios) {
      if (s.scenarioName === 'Current Path') {
        map.set(s.id, BASELINE_COLOUR);
      } else {
        const isWorse = s.summary.retirementNetWorthP50 < baselineNW;
        map.set(
          s.id,
          isWorse
            ? NEGATIVE_COLOURS[negIdx++ % NEGATIVE_COLOURS.length]
            : POSITIVE_COLOURS[posIdx++ % POSITIVE_COLOURS.length]
        );
      }
    }
    return map;
  }, [scenarios]);

  if (scenarios.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 flex-wrap">
        {scenarios.map((scenario) => {
          const isActive = scenario.id === activeScenarioId;
          const isBaseline = scenario.scenarioName === 'Current Path';
          const colour = colourMap.get(scenario.id) ?? BASELINE_COLOUR;

          return (
            <div key={scenario.id} className="group relative flex items-center">
              <button
                type="button"
                onClick={() => onActiveChange(scenario.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-full transition-colors ${
                  isActive
                    ? 'bg-ws-black text-white'
                    : isBaseline
                    ? 'bg-ws-bg text-ws-text-secondary border border-dashed border-ws-border hover:bg-ws-hover'
                    : 'bg-ws-bg text-ws-text-secondary hover:bg-ws-hover hover:text-ws-text'
                }`}
              >
                {isBaseline ? (
                  <svg width="12" height="2" className="flex-shrink-0">
                    <line
                      x1="0" y1="1" x2="12" y2="1"
                      stroke={isActive ? 'currentColor' : colour}
                      strokeWidth="2"
                      strokeDasharray="3 2"
                    />
                  </svg>
                ) : (
                  <span
                    className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: isActive ? 'currentColor' : colour }}
                  />
                )}
                {scenario.scenarioName}
              </button>
              {!isBaseline && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeScenario(scenario.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 p-0.5 rounded-full bg-white border border-ws-border shadow-sm hover:bg-ws-hover transition-all"
                  aria-label={`Delete ${scenario.scenarioName}`}
                >
                  <X size={10} className="text-ws-text-tertiary hover:text-ws-red" />
                </button>
              )}
            </div>
          );
        })}

        {/* + Variant button */}
        <button
          type="button"
          onClick={() => setChatPrompt('variant')}
          className="flex items-center gap-0.5 px-3 py-1.5 text-xs text-ws-text-secondary hover:text-ws-text rounded-full hover:bg-ws-hover transition-colors"
        >
          <Plus size={11} />
          Variant
        </button>

        {/* Expand detail - opens simulation modal for active scenario */}
        {activeScenarioId && (
          <button
            type="button"
            onClick={() => {
              switchToScenario(activeScenarioId);
              const scenario = scenarios.find((s) => s.id === activeScenarioId);
              if (scenario) openSimulationModal(scenario.scenarioName);
            }}
            className="ml-auto p-1.5 rounded-lg text-ws-text-tertiary hover:text-ws-text hover:bg-ws-hover transition-colors"
            aria-label="View scenario detail"
            title="View scenario detail"
          >
            <Expand size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
