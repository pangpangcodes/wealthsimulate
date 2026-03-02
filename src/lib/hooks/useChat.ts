'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { ChatMessage, ToolCallInfo, ScenarioOverrides, SimulationResults, AnalysisDepth } from '@/lib/types';
import { useProfileStore } from '@/lib/store/profile-store';
import { useSimulationStore } from '@/lib/store/simulation-store';
import { computeConfidence } from '@/lib/simulation/limitations';
import { generateMetricCards, generateVerdict } from '@/lib/simulation/insights';

// ─── Condense simulation results into a compact payload for Claude ──────────

export function condenseSummary(results: SimulationResults): string {
  const s = results.summary;
  const milestoneYears = [1, 2, 3, 5, 10, 20, 30];
  const milestones = milestoneYears
    .map((offset) => {
      const entry = results.yearlyData.find(
        (d) => d.year === results.config.startYear + offset
      );
      return entry
        ? `Year ${offset} (age ${entry.age}): p10=$${Math.round(entry.p10).toLocaleString()} | p50=$${Math.round(entry.p50).toLocaleString()} | p90=$${Math.round(entry.p90).toLocaleString()}`
        : null;
    })
    .filter(Boolean)
    .join('\n');

  const goalLines = s.goalOutcomes
    .map(
      (g) =>
        `- ${g.goal.name} ($${g.goal.targetAmount.toLocaleString()} by ${g.goal.targetYear}): ${(g.probabilityOfSuccess * 100).toFixed(0)}% chance of success${g.shortfallP50 > 0 ? `, likely shortfall $${Math.round(g.shortfallP50).toLocaleString()}` : ''}`
    )
    .join('\n');

  return `[SIMULATION_RESULTS]
Scenario: ${results.scenarioName}
Simulated Futures: ${results.validPaths.toLocaleString()} of ${results.totalPaths.toLocaleString()}

RETIREMENT METRICS:
- Retirement annual income (most likely): $${Math.round(s.retirementAnnualIncomeP50).toLocaleString()}/year (today's dollars)
- Income replacement: ${(s.incomeReplacementRatio * 100).toFixed(0)}% of after-tax working income ($${Math.round(s.incomeReplacementTarget ?? results.config.profile.annualIncome).toLocaleString()}/year)
- Money lasts to: Age ${s.moneyLastsToAge}
- Government pensions (CPP/OAS): ~$${Math.round(s.cppOasAnnualIncome).toLocaleString()}/year
- Portfolio income needed: ~$${Math.round(Math.max(0, s.retirementAnnualIncomeP50 - s.cppOasAnnualIncome)).toLocaleString()}/year
- Retirement net worth (most likely): $${Math.round(s.retirementNetWorthP50).toLocaleString()}
- Retirement net worth (worst case): $${Math.round(s.retirementNetWorthP10).toLocaleString()}
- Retirement net worth (best case): $${Math.round(s.retirementNetWorthP90).toLocaleString()}
- Peak net worth year: ${s.peakNetWorthYear}

YEARLY MILESTONES:
${milestones}
${goalLines ? `\nGOAL OUTCOMES:\n${goalLines}` : ''}`;
}

export function buildAnalysisPayload(
  results: SimulationResults,
  baseline: SimulationResults | null,
  siblingVariant?: SimulationResults | null
): string {
  let payload = condenseSummary(results);

  if (baseline && baseline.id !== results.id) {
    const bs = baseline.summary;
    const rs = results.summary;
    const incomeChange = rs.retirementAnnualIncomeP50 - bs.retirementAnnualIncomeP50;
    const nwChange = rs.retirementNetWorthP50 - bs.retirementNetWorthP50;
    payload += `

COMPARISON VS BASELINE ("${baseline.scenarioName}"):
- Retirement net worth change: ${nwChange >= 0 ? '+' : ''}$${Math.round(nwChange).toLocaleString()} ($${Math.round(rs.retirementNetWorthP50).toLocaleString()} vs $${Math.round(bs.retirementNetWorthP50).toLocaleString()})
- Retirement income change: ${incomeChange >= 0 ? '+' : ''}$${Math.round(incomeChange).toLocaleString()}/year (${bs.retirementAnnualIncomeP50 > 0 ? ((incomeChange / bs.retirementAnnualIncomeP50) * 100).toFixed(1) : '0'}%)
- Income replacement change: ${((rs.incomeReplacementRatio - bs.incomeReplacementRatio) * 100).toFixed(1)} percentage points
- Money lasts to change: Age ${rs.moneyLastsToAge} vs Age ${bs.moneyLastsToAge}
- Baseline retirement net worth: $${Math.round(bs.retirementNetWorthP50).toLocaleString()}
- Baseline retirement income: $${Math.round(bs.retirementAnnualIncomeP50).toLocaleString()}/year
- Baseline income replacement: ${(bs.incomeReplacementRatio * 100).toFixed(0)}%`;
  }

  // Add confidence assessment
  const confidence = computeConfidence(results, results.config.scenario);
  payload += `

CONFIDENCE ASSESSMENT:
- Level: ${confidence.level}
- Spread ratio (P90-P10 / P50): ${confidence.spreadRatio.toFixed(2)}
- Scenario overrides: ${confidence.overrideCount}
- Guidance: ${confidence.guidance}`;

  // Add visible dashboard metrics so Claude knows what the user sees
  const cards = generateMetricCards(results, baseline ?? null);
  const verdict = generateVerdict(results);

  payload += `\n\nVISIBLE DASHBOARD (what the user sees):`;
  payload += `\nVerdict: [${verdict.severity.toUpperCase()}] ${verdict.message} - ${verdict.subtext}`;
  for (const card of cards) {
    let line = `\n- ${card.label}: ${card.value}`;
    if (card.subtext) line += ` (${card.subtext})`;
    if (card.delta) line += ` [${card.delta.label}]`;
    payload += line;
  }

  // Add near-term cash flow section for career gap scenarios
  const careerChange = results.config.scenario.careerChange;
  if (careerChange && careerChange.gapMonths > 0) {
    const profile = results.config.profile;
    const gapMonths = careerChange.gapMonths;
    const monthlyExpenses = profile.monthlyExpenses;
    const annualIncomeLost = profile.annualIncome;
    const additionalIncome = results.config.scenario.additionalIncome ?? 0;

    // Liquid assets: chequing + non-registered (accessible without tax penalty)
    const liquidAccounts = profile.accounts
      .filter((a) => a.type === 'non-registered' || a.type === 'chequing')
      .reduce((sum, a) => sum + a.marketValue, 0);

    const monthlyRunway = monthlyExpenses > 0
      ? Math.floor(liquidAccounts / monthlyExpenses)
      : 0;

    // Find Year 1 net worth from milestones
    const year1Entry = results.yearlyData.find(
      (d) => d.year === results.config.startYear + 1
    );

    payload += `

NEAR-TERM CASH FLOW (career gap analysis):
- Gap duration: ${gapMonths} months
- Monthly expenses: $${monthlyExpenses.toLocaleString()}/mo
- Annual income lost during gap: $${annualIncomeLost.toLocaleString()}
- Additional income during gap (EI/severance): $${additionalIncome.toLocaleString()}/yr
- Liquid accounts (chequing + non-registered): $${Math.round(liquidAccounts).toLocaleString()}
- Estimated months of runway at current expenses: ${monthlyRunway} months${year1Entry ? `\n- Net worth at Year 1 (most likely): $${Math.round(year1Entry.p50).toLocaleString()}` : ''}`;
  }

  // Add sibling variant comparison for career-gap scenarios (e.g. "No EI" vs "With EI")
  if (siblingVariant && siblingVariant.id !== results.id) {
    const sibNw = siblingVariant.summary.retirementNetWorthP50;
    const thisNw = results.summary.retirementNetWorthP50;
    const nwDiff = thisNw - sibNw;
    const sibAge = siblingVariant.summary.moneyLastsToAge;
    const thisAge = results.summary.moneyLastsToAge;
    payload += `

SIBLING VARIANT COMPARISON ("${siblingVariant.scenarioName}" vs this "${results.scenarioName}"):
- Retirement net worth difference: ${nwDiff >= 0 ? '+' : ''}$${Math.round(Math.abs(nwDiff)).toLocaleString()} (${nwDiff >= 0 ? 'this variant is better' : 'sibling is better'})
- Money lasts to: Age ${sibAge} (${siblingVariant.scenarioName}) vs Age ${thisAge} (${results.scenarioName})
- Sibling retirement net worth: $${Math.round(sibNw).toLocaleString()}
- This retirement net worth: $${Math.round(thisNw).toLocaleString()}`;
  }

  return payload;
}

// ─────────────────────────────────────────────────────────────────────────────

interface UseChatReturn {
  messages: ChatMessage[];
  visibleMessages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  sendSimulationResults: (results: SimulationResults, baseline?: SimulationResults | null, depth?: AnalysisDepth, options?: { silent?: boolean; siblingVariant?: SimulationResults | null }) => Promise<string | null>;
  injectAssistantMessage: (text: string) => void;
  stop: () => void;
  clearMessages: () => void;
}

const CHAT_STORAGE_KEY = 'ws-chat-messages-v1';

export function useChat(onSimulationRequest?: (scenario: ScenarioOverrides) => void): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useProfileStore((s) => s.profile);
  const savedScenarios = useSimulationStore((s) => s.savedScenarios);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const abortRef = useRef<AbortController | null>(null);

  // Clear any stale chat messages on mount so refresh always starts blank
  useEffect(() => {
    try { sessionStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  // Filter out hidden messages for display
  const visibleMessages = messages.filter((m) => !m.isHidden);

  const callChatApi = useCallback(async (
    allMessages: ChatMessage[],
    extraFlags?: { isAnalysis?: boolean; analysisDepth?: AnalysisDepth },
    onStreamDelta?: (text: string) => void,
  ) => {
    // Create a new AbortController for this request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const apiMessages = allMessages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Build scenario summaries for cross-scenario synthesis
    const savedScenarioSummaries = savedScenarios.map((s) => ({
      name: s.scenarioName,
      retirementAnnualIncomeP50: s.summary.retirementAnnualIncomeP50,
      incomeReplacementRatio: s.summary.incomeReplacementRatio,
      moneyLastsToAge: s.summary.moneyLastsToAge,
      retirementNetWorthP50: s.summary.retirementNetWorthP50,
      retirementNetWorthP10: s.summary.retirementNetWorthP10,
      retirementNetWorthP90: s.summary.retirementNetWorthP90,
      cppOasAnnualIncome: s.summary.cppOasAnnualIncome,
      worstCaseNetWorth: s.summary.worstCaseNetWorth,
      bestCaseNetWorth: s.summary.bestCaseNetWorth,
    }));

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: apiMessages,
        profile: profileRef.current,
        savedScenarioNames: savedScenarios.map((s) => s.scenarioName),
        savedScenarioSummaries,
        ...(extraFlags?.analysisDepth && { analysisDepth: extraFlags.analysisDepth }),
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    // Read SSE stream with RAF-batched UI updates
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    let toolCalls: ToolCallInfo[] = [];
    let buffer = '';
    let rafId: number | null = null;
    let pendingFlush = false;

    const flushToUi = () => {
      rafId = null;
      pendingFlush = false;
      onStreamDelta?.(fullText);
    };

    const scheduleFlush = () => {
      if (!pendingFlush && onStreamDelta) {
        pendingFlush = true;
        rafId = requestAnimationFrame(flushToUi);
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') continue;

        try {
          const event = JSON.parse(payload);
          if (event.type === 'delta') {
            fullText += event.text;
            scheduleFlush();
          } else if (event.type === 'text') {
            fullText = event.text;
            scheduleFlush();
          } else if (event.type === 'tool_results') {
            toolCalls = (event.toolResults || []).map(
              (tr: { toolName: string; input: Record<string, unknown>; output: Record<string, unknown> }) => ({
                toolName: tr.toolName,
                input: tr.input,
                output: tr.output,
                status: 'complete' as const,
              })
            );
          } else if (event.type === 'error') {
            throw new Error(event.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue;
          throw e;
        }
      }
    }

    // Flush any remaining content
    if (rafId !== null) cancelAnimationFrame(rafId);
    onStreamDelta?.(fullText);

    // Process tool results for side effects
    for (const tr of toolCalls) {
      if (
        !extraFlags?.isAnalysis &&
        tr.toolName === 'run_simulation' &&
        tr.output?.status === 'simulation_requested' &&
        tr.output?.scenario &&
        onSimulationRequest
      ) {
        onSimulationRequest(tr.output.scenario as ScenarioOverrides);
      }

      if (tr.toolName === 'update_profile' && tr.output?.status === 'profile_updated') {
        const { field, newValue } = tr.output;
        if (field && newValue !== undefined) {
          useProfileStore.getState().updateField(
            field as keyof typeof profileRef.current,
            newValue as never
          );
        }
      }

      if (tr.toolName === 'add_goal' && tr.output?.status === 'goal_added' && tr.output?.goal) {
        const goal = tr.output.goal as {
          id: string;
          type: string;
          name: string;
          targetAmount: number;
          targetYear: number;
          priority: string;
        };
        useProfileStore.getState().addGoal({
          id: goal.id,
          type: goal.type as 'retirement' | 'education' | 'emergency-fund' | 'major-purchase' | 'debt-payoff' | 'custom',
          name: goal.name,
          targetAmount: goal.targetAmount,
          targetYear: goal.targetYear,
          priority: goal.priority as 'essential' | 'important' | 'aspirational',
        });
      }
    }

    return {
      text: fullText || 'I processed your request.',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      isAnalysis: extraFlags?.isAnalysis,
    };
  }, [savedScenarios, onSimulationRequest]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSendingMessage) return;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setIsSendingMessage(true);
    setError(null);

    try {
      const allMessages = [...messages, userMessage];
      const assistantId = `msg-${Date.now()}-assistant`;

      // Add a streaming placeholder message
      setMessages((prev) => [...prev, {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        isStreaming: true,
      }]);

      const result = await callChatApi(allMessages, undefined, (text) => {
        setMessages((prev) => prev.map((m) =>
          m.id === assistantId ? { ...m, content: text } : m
        ));
      });

      // Finalize the message
      setMessages((prev) => prev.map((m) =>
        m.id === assistantId ? { ...m, content: result.text, isStreaming: false, toolCalls: result.toolCalls } : m
      ));
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        // User cancelled - just stop loading
        return;
      }
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
      setIsSendingMessage(false);
    }
  }, [isSendingMessage, messages, callChatApi]);

  const sendSimulationResults = useCallback(async (
    results: SimulationResults,
    baseline?: SimulationResults | null,
    depth?: AnalysisDepth,
    options?: { silent?: boolean; siblingVariant?: SimulationResults | null }
  ): Promise<string | null> => {
    if (isLoading) return null;

    const effectiveDepth = depth ?? 'detailed';
    const silent = options?.silent ?? false;
    const payload = buildAnalysisPayload(results, baseline ?? null, options?.siblingVariant);

    const hiddenMessage: ChatMessage = {
      id: `msg-${Date.now()}-simresults`,
      role: 'user',
      content: payload,
      timestamp: Date.now(),
      isHidden: true,
    };

    if (!silent) setMessages((prev) => [...prev, hiddenMessage]);
    if (!silent) setIsLoading(true);
    setError(null);

    try {
      const contextMessages = silent ? [hiddenMessage] : [...messages, hiddenMessage];
      const analysisId = `msg-${Date.now()}-analysis`;

      if (!silent) {
        setMessages((prev) => [...prev, {
          id: analysisId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          isStreaming: true,
          isAnalysis: true,
          analysisDepth: effectiveDepth,
          scenarioName: results.scenarioName,
        }]);
      }

      const result = await callChatApi(
        contextMessages,
        { isAnalysis: true, analysisDepth: effectiveDepth },
        silent ? undefined : (text) => {
          setMessages((prev) => prev.map((m) =>
            m.id === analysisId ? { ...m, content: text } : m
          ));
        }
      );

      if (!silent) {
        setMessages((prev) => prev.map((m) =>
          m.id === analysisId ? { ...m, content: result.text, isStreaming: false, toolCalls: result.toolCalls } : m
        ));
      }
      return result.text;
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return null;
      }
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-${Date.now()}-error`,
          role: 'assistant',
          content: 'Sorry, I had trouble analyzing the results. Please try again.',
          timestamp: Date.now(),
        },
      ]);
      return null;
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [isLoading, messages, callChatApi]);

  const injectAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, {
      id: `msg-${Date.now()}-assistant`,
      role: 'assistant',
      content: text,
      timestamp: Date.now(),
    }]);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
    setIsSendingMessage(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    try { sessionStorage.removeItem(CHAT_STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  return { messages, visibleMessages, isLoading, error, sendMessage, sendSimulationResults, injectAssistantMessage, stop, clearMessages };
}
