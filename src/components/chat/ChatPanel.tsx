'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Mic, MicOff, Square, Trash2 } from 'lucide-react';
import { useChat } from '@/lib/hooks/useChat';
import { useVoiceInput } from '@/lib/hooks/useVoiceInput';
import { useSimulationStore } from '@/lib/store/simulation-store';
import type { ScenarioOverrides } from '@/lib/types';
import { SUGGESTED_PROMPTS } from '@/lib/simulation/scenarios';
import ChatMessage from './ChatMessage';

interface ChatPanelProps {
  onSimulationRequest?: (scenario: ScenarioOverrides) => void;
}

export default function ChatPanel({ onSimulationRequest }: ChatPanelProps) {
  const { visibleMessages, isLoading, sendMessage, sendSimulationResults, injectAssistantMessage, stop, clearMessages } = useChat(onSimulationRequest);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isEmpty = visibleMessages.length === 0;

  // Watch for pending analysis results and auto-send to Claude
  const pendingAnalysis = useSimulationStore((s) => s.pendingAnalysis);
  const savedScenarios = useSimulationStore((s) => s.savedScenarios);
  const setPendingAnalysis = useSimulationStore((s) => s.setPendingAnalysis);
  const setModalAnalysisSummary = useSimulationStore((s) => s.setModalAnalysisSummary);
  const pendingChatPrompt = useSimulationStore((s) => s.pendingChatPrompt);
  const setChatPrompt = useSimulationStore((s) => s.setChatPrompt);
  const openSimulationModal = useSimulationStore((s) => s.openSimulationModal);
  const analysisSentForId = useRef<string | null>(null);

  useEffect(() => {
    if (!pendingAnalysis || isLoading) return;
    // Guard against sending analysis for the same simulation twice
    if (analysisSentForId.current === pendingAnalysis.id) {
      setPendingAnalysis(null);
      return;
    }
    const isBaseline = pendingAnalysis.scenarioName === 'Current Path';
    analysisSentForId.current = pendingAnalysis.id;
    const scenarioId = pendingAnalysis.id;
    const baseline = savedScenarios.find((s) => s.scenarioName === 'Current Path') ?? null;

    // Detect sibling variant: another career-gap scenario with same gapMonths and year but different id
    let siblingVariant = null;
    const cc = pendingAnalysis.config.scenario.careerChange;
    if (cc && cc.gapMonths > 0) {
      siblingVariant = savedScenarios.find((s) => {
        if (s.id === pendingAnalysis.id) return false;
        const scc = s.config.scenario.careerChange;
        return scc && scc.gapMonths === cc.gapMonths && scc.year === cc.year;
      }) ?? null;
    }

    // Baseline runs silently (no chat messages) since it re-runs every mount
    sendSimulationResults(pendingAnalysis, baseline, 'summary', { silent: isBaseline, siblingVariant }).then((summary) => {
      if (summary) {
        setModalAnalysisSummary(scenarioId, summary);
      }
    });
    setPendingAnalysis(null);
  }, [pendingAnalysis, isLoading, savedScenarios, sendSimulationResults, setPendingAnalysis, setModalAnalysisSummary]);

  // Handle chat prompt signal (from insight cards or "+ Variant" buttons)
  useEffect(() => {
    if (!pendingChatPrompt) return;
    const prompt = pendingChatPrompt;
    setChatPrompt(null);
    scrollCountRef.current = 3;
    // If the prompt looks like a user question, send it directly
    if (prompt.endsWith('?') || prompt.startsWith('What')) {
      sendMessage(prompt);
    } else {
      // Otherwise inject as assistant prompt
      injectAssistantMessage('What variable or variables would you like to change?');
    }
    // Ensure scroll reaches bottom after the loading indicator renders
    const timer = setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
    return () => clearTimeout(timer);
  }, [pendingChatPrompt, setChatPrompt, injectAssistantMessage, sendMessage]);

  // Only auto-scroll when the user sends a message, not on every update.
  // This lets users read streamed responses from the start without being yanked to the bottom.
  // Uses a counter so the scroll survives multiple render cycles (message added, then loading dots appear).
  const scrollCountRef = useRef(0);
  useEffect(() => {
    if (scrollCountRef.current > 0) {
      scrollCountRef.current--;
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleMessages, isLoading]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) return;
      scrollCountRef.current = 3;
      setInput('');
      if (inputRef.current) inputRef.current.style.height = 'auto';
      sendMessage(trimmed);
    },
    [isLoading, sendMessage]
  );

  const handleFinalTranscript = useCallback(
    (text: string) => {
      setInput('');
      handleSend(text);
    },
    [handleSend]
  );

  const handleInterimTranscript = useCallback((text: string) => {
    setInput(text);
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
    }
    // Re-anchor scroll so messages don't jump during speech
    bottomRef.current?.scrollIntoView({ behavior: 'instant' });
  }, []);

  const voice = useVoiceInput({
    onFinalTranscript: handleFinalTranscript,
    onInterimTranscript: handleInterimTranscript,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(input);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Message thread */}
      <div className="flex-1 overflow-y-auto overscroll-contain p-4 space-y-4 min-h-0 scrollbar-hide">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 pb-4">
            <div className="text-center space-y-1.5">
              <p className="text-base font-semibold text-ws-text">
                I've been analyzing your finances
              </p>
              <p className="text-xs text-ws-text-tertiary">
                Ask me anything, or try one of these
              </p>
            </div>

            {/* Voice button */}
            <button
              onClick={voice.isRecording ? voice.stop : voice.start}
              disabled={!voice.isSupported || isLoading}
              className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${
                voice.isRecording
                  ? 'bg-ws-red text-white scale-110 animate-recording-pulse'
                  : 'bg-ws-black text-white hover:bg-ws-dark hover:scale-105 active:scale-95'
              } disabled:opacity-40 disabled:cursor-not-allowed`}
              aria-label={voice.isRecording ? 'Stop recording' : 'Start voice input'}
            >
              {voice.isRecording ? <MicOff size={32} /> : <Mic size={32} />}
            </button>

            {input && (
              <p className="text-sm text-ws-text-secondary italic text-center max-w-[260px]">
                &ldquo;{input}&rdquo;
              </p>
            )}

            {voice.isRecording && !input && (
              <p className="text-xs text-ws-red animate-pulse">Listening...</p>
            )}

            {!voice.isSupported && (
              <p className="text-xs text-ws-text-tertiary">Voice not supported in this browser</p>
            )}

            {/* Suggested prompts */}
            <div className="flex flex-col gap-2 mt-1 px-2 w-full max-w-xs">
              {SUGGESTED_PROMPTS.slice(0, 4).map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => {
                    handleSend(prompt.prompt);
                    if (prompt.category === 'analysis') {
                      openSimulationModal('Current Path');
                    }
                  }}
                  className="text-xs px-3.5 py-2 rounded-xl bg-ws-green-light text-ws-green text-left leading-snug hover:bg-ws-green/15 transition-colors"
                >
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {visibleMessages.map((msg) => (
              // Hide streaming placeholder until content starts arriving
              msg.isStreaming && !msg.content ? null : (
                <ChatMessage key={msg.id} message={msg} onSuggestionClick={handleSend} />
              )
            ))}

            {isLoading && !visibleMessages.some((m) => m.isStreaming && m.content) && (
              <div className="flex justify-start">
                <div className="w-7 h-7 rounded-full bg-ws-green/10 flex items-center justify-center mr-2 flex-shrink-0">
                  <Loader2 size={14} className="text-ws-green animate-spin" />
                </div>
                <div className="bg-white border border-ws-border px-4 py-2.5 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-ws-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-ws-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-ws-text-tertiary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Clear conversation button */}
      {!isEmpty && (
        <div className="flex justify-end px-4 pb-2">
          <button
            type="button"
            onClick={clearMessages}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs text-ws-text-tertiary hover:text-ws-red transition-colors disabled:opacity-40"
            aria-label="Clear conversation"
          >
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      )}

      {/* Input row */}
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 p-3 border-t border-ws-border bg-white flex-shrink-0"
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            // Auto-resize, then re-anchor scroll so messages don't jump
            e.target.style.height = 'auto';
            e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            bottomRef.current?.scrollIntoView({ behavior: 'instant' });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder={voice.isRecording ? 'Listening...' : 'Ask about your financial future...'}
          rows={1}
          className="flex-1 text-sm px-3 py-2 rounded-xl border border-ws-border bg-ws-bg focus:outline-none focus:ring-1 focus:ring-ws-black/20 min-w-0 placeholder:text-ws-text-tertiary resize-none overflow-hidden"
        />

        {/* Inline mic */}
        {!isEmpty && (
          <button
            type="button"
            onClick={voice.isRecording ? voice.stop : voice.start}
            disabled={!voice.isSupported || isLoading}
            title={voice.isRecording ? 'Stop recording' : 'Start voice input'}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
              voice.isRecording
                ? 'text-ws-red bg-ws-red-light animate-pulse'
                : 'text-ws-text-tertiary hover:text-ws-text hover:bg-ws-hover'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Mic size={18} />
          </button>
        )}

        {isLoading ? (
          <button
            type="button"
            onClick={stop}
            className="p-2 rounded-lg bg-ws-red text-white hover:bg-ws-red/80 transition-colors flex-shrink-0"
            aria-label="Stop generating"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!input.trim()}
            className="p-2 rounded-lg bg-ws-black text-white hover:bg-ws-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
          >
            <Send size={16} />
          </button>
        )}
      </form>
    </div>
  );
}
