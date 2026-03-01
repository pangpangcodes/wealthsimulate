'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X } from 'lucide-react';
import ChatPanel from './ChatPanel';
import { useSimulationStore } from '@/lib/store/simulation-store';
import type { ScenarioOverrides } from '@/lib/types';

interface ChatBubbleProps {
  onSimulationRequest?: (scenario: ScenarioOverrides) => void;
}

export default function ChatBubble({ onSimulationRequest }: ChatBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasAutoOpened = useRef(false);
  const pendingAnalysis = useSimulationStore((s) => s.pendingAnalysis);

  const pendingChatPrompt = useSimulationStore((s) => s.pendingChatPrompt);

  // Auto-open chat when first simulation results arrive (welcome analysis)
  useEffect(() => {
    if (pendingAnalysis && !hasAutoOpened.current) {
      hasAutoOpened.current = true;
      // Small delay so the dashboard renders first
      const timer = setTimeout(() => setIsOpen(true), 500);
      return () => clearTimeout(timer);
    }
  }, [pendingAnalysis]);

  // Auto-open chat when a chat prompt signal is set (e.g. "+ Variant")
  useEffect(() => {
    if (pendingChatPrompt) {
      setIsOpen(true);
    }
  }, [pendingChatPrompt]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 lg:hidden">
      {/* Chat panel */}
      <div
        className={`w-[400px] bg-ws-bg rounded-2xl shadow-2xl border border-ws-border flex flex-col overflow-hidden min-h-0 transition-all duration-200 ${
          isOpen ? 'opacity-100 pointer-events-auto translate-y-0' : 'opacity-0 pointer-events-none translate-y-2'
        }`}
        style={{ height: 'calc(100vh - 8rem)', maxHeight: '600px' }}
        aria-hidden={!isOpen}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ws-border bg-white rounded-t-2xl flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-ws-green" />
            <span className="text-sm font-semibold text-ws-text">Financial Simulator</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-ws-text-tertiary hover:text-ws-text transition-colors p-1 rounded-lg hover:bg-ws-hover"
          >
            <X size={16} />
          </button>
        </div>

        <ChatPanel onSimulationRequest={onSimulationRequest} />

        {/* Disclaimer */}
        <div className="px-3 py-2 border-t border-ws-border bg-ws-bg flex-shrink-0">
          <p className="text-[10px] text-ws-text-tertiary text-center leading-tight">
            AI-generated projections for educational purposes only. Not financial advice.
          </p>
        </div>
      </div>

      {/* Floating button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-14 h-14 rounded-full bg-ws-black hover:bg-ws-dark text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        aria-label={isOpen ? 'Close chat' : 'Open AI chat'}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
