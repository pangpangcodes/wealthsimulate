'use client';

import { useMemo } from 'react';
import { AlertTriangle, Lightbulb, Info, Sparkles } from 'lucide-react';
import type { SimulationResults, FinancialProfile } from '@/lib/types';
import { generateProactiveInsights, generateVerdict, type InsightCard, type InsightSeverity } from '@/lib/simulation/insights';
import { useSimulationStore } from '@/lib/store/simulation-store';

interface ProactiveInsightsProps {
  results: SimulationResults;
  baseline: SimulationResults | null;
  profile: FinancialProfile;
}

const SEVERITY_CONFIG: Record<InsightSeverity, {
  icon: typeof AlertTriangle;
  bg: string;
  border: string;
  iconColor: string;
  titleColor: string;
}> = {
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    titleColor: 'text-amber-700',
  },
  opportunity: {
    icon: Lightbulb,
    bg: 'bg-ws-green-light',
    border: 'border-ws-green/20',
    iconColor: 'text-ws-green',
    titleColor: 'text-ws-green',
  },
  info: {
    icon: Info,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-500',
    titleColor: 'text-blue-700',
  },
};

export default function ProactiveInsights({ results, baseline, profile }: ProactiveInsightsProps) {
  const setChatPrompt = useSimulationStore((s) => s.setChatPrompt);

  const verdict = useMemo(() => generateVerdict(results), [results]);

  const verdictCard: InsightCard | null = useMemo(() => {
    if (!verdict || verdict.severity === 'green') return null;
    return {
      id: 'verdict',
      severity: 'warning',
      title: verdict.message,
      body: verdict.subtext,
      chatPrompt: verdict.chatPrompt,
    };
  }, [verdict]);

  const insights = useMemo(
    () => generateProactiveInsights(results, baseline, profile),
    [results, baseline, profile]
  );

  const allInsights = useMemo(
    () => (verdictCard ? [verdictCard, ...insights] : insights),
    [verdictCard, insights]
  );

  if (allInsights.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-ws-border p-5 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-ws-green/10 flex items-center justify-center flex-shrink-0">
          <Sparkles size={16} className="text-ws-green" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ws-text">What I noticed</h3>
          <p className="text-xs text-ws-text-tertiary">Based on your accounts and simulations</p>
        </div>
      </div>
      <div className="space-y-2">
        {allInsights.map((insight) => (
          <InsightCardView
            key={insight.id}
            insight={insight}
            onChatPrompt={insight.chatPrompt ? () => setChatPrompt(insight.chatPrompt!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function InsightCardView({
  insight,
  onChatPrompt,
}: {
  insight: InsightCard;
  onChatPrompt?: () => void;
}) {
  const config = SEVERITY_CONFIG[insight.severity];
  const Icon = config.icon;

  return (
    <div className={`rounded-xl border ${config.border} ${config.bg} p-4`}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={`${config.iconColor} mt-0.5 flex-shrink-0`} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold ${config.titleColor}`}>{insight.title}</p>
          <p className="text-sm text-ws-text-secondary mt-0.5 leading-relaxed">{insight.body}</p>
          {onChatPrompt && (
            <button
              type="button"
              onClick={onChatPrompt}
              className="mt-2 text-sm text-ws-green hover:text-ws-green/80 transition-colors text-left font-medium"
            >
              Ask me about this &rarr;
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
