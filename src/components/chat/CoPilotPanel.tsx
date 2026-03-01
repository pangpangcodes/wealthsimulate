'use client';

import { Sparkles } from 'lucide-react';
import ChatPanel from './ChatPanel';
import type { ScenarioOverrides } from '@/lib/types';

interface CoPilotPanelProps {
  onSimulationRequest?: (scenario: ScenarioOverrides) => void;
}

export default function CoPilotPanel({ onSimulationRequest }: CoPilotPanelProps) {
  return (
    <div className="flex flex-col flex-1 bg-white rounded-xl border border-ws-border overflow-hidden min-h-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-ws-border flex-shrink-0">
        <div className="w-2 h-2 rounded-full bg-ws-green animate-pulse" />
        <span className="text-sm font-semibold text-ws-text">Your co-pilot</span>
        <Sparkles size={14} className="text-ws-green ml-auto" />
      </div>

      {/* Chat fills remaining space */}
      <ChatPanel onSimulationRequest={onSimulationRequest} />

      {/* Disclaimer */}
      <div className="px-3 py-2 border-t border-ws-border bg-ws-bg flex-shrink-0">
        <p className="text-[10px] text-ws-text-tertiary text-center leading-tight">
          AI-generated projections for educational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  );
}
