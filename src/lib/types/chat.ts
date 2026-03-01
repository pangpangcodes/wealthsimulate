import type { SimulationResults } from './simulation';

export type AnalysisDepth = 'summary' | 'detailed';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;

  // Tool use tracking
  toolCalls?: ToolCallInfo[];

  // If this message triggered a simulation
  simulationResults?: SimulationResults;

  // Loading state
  isStreaming?: boolean;

  // Hidden messages (e.g. auto-sent simulation results) are sent to Claude but not shown in UI
  isHidden?: boolean;

  // Analysis messages get structured styling
  isAnalysis?: boolean;

  // Controls whether this analysis is a brief summary or detailed breakdown
  analysisDepth?: AnalysisDepth;

  // Scenario name for distinguishing analysis messages
  scenarioName?: string;
}

export interface ToolCallInfo {
  toolName: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'running' | 'complete' | 'error';
}

export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
}

export interface SuggestedPrompt {
  label: string;
  prompt: string;
  category: 'scenario' | 'analysis' | 'profile';
}
