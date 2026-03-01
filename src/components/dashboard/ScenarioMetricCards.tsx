'use client';

import type { SimulationResults } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { generateMetricCards } from '@/lib/simulation/insights';

interface ScenarioMetricCardsProps {
  activeScenario: SimulationResults;
  baseline: SimulationResults | null;
}

export default function ScenarioMetricCards({ activeScenario, baseline }: ScenarioMetricCardsProps) {
  const metricCards = generateMetricCards(activeScenario, baseline);

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
        {metricCards.map((card) => (
          <div key={card.label} className="bg-ws-bg rounded-lg px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-ws-text-tertiary mb-1">
              {card.label}
            </p>
            <p className={`text-lg font-semibold ${
              card.severity === 'green' ? 'text-ws-green'
                : card.severity === 'amber' ? 'text-amber-600'
                : card.severity === 'red' ? 'text-ws-red'
                : 'text-ws-text'
            }`}>
              {card.value}
            </p>
            {card.subtext && (
              <p className="text-xs mt-0.5 text-ws-text-secondary">{card.subtext}</p>
            )}
            {card.delta && (
              <p className={`text-xs mt-0.5 ${card.delta.positive ? 'text-ws-green' : 'text-ws-red'}`}>
                {card.delta.label}
              </p>
            )}
          </div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
