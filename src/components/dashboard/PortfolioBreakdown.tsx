'use client';

import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { useProfileStore } from '@/lib/store/profile-store';
import { useSimulationStore } from '@/lib/store/simulation-store';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { AllocationSummary } from '@/lib/types';

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// ── Deterministic insight generation ────────────────────────────────────────

interface Insight {
  text: string;
  tone: 'positive' | 'neutral' | 'caution';
}

function generateInsights(
  data: AllocationSummary[],
  age: number,
  retirementAge: number,
): Insight[] {
  const insights: Insight[] = [];
  const yearsToRetirement = retirementAge - age;

  // Calculate aggregate allocation buckets
  const equityClasses = ['canadian-equity', 'us-equity', 'international-equity', 'emerging-markets'];
  const bondClasses = ['canadian-bonds', 'international-bonds', 'high-yield-bonds'];

  const totalPct = (classes: string[]) =>
    data
      .filter((d) => classes.includes(d.assetClass))
      .reduce((sum, d) => sum + d.percentage, 0);

  const equityPct = totalPct(equityClasses);
  const bondPct = totalPct(bondClasses);
  const canadianEquityPct = totalPct(['canadian-equity']);
  const usPct = totalPct(['us-equity']);
  const intlPct = totalPct(['international-equity']);
  const emPct = totalPct(['emerging-markets']);
  const goldPct = totalPct(['gold']);

  // 1. Equity/bond ratio vs age-based rule of thumb
  const suggestedEquity = Math.min(0.95, Math.max(0.50, (100 - age) / 100));
  const equityDelta = equityPct - suggestedEquity;

  if (yearsToRetirement > 20) {
    if (equityPct >= 0.65) {
      insights.push({
        text: `**${(equityPct * 100).toFixed(0)}% equities** is growth-oriented - well-suited for ${yearsToRetirement} years to retirement.`,
        tone: 'positive',
      });
    } else {
      insights.push({
        text: `At **${(equityPct * 100).toFixed(0)}% equities** with ${yearsToRetirement} years to retirement, you have room to take on more growth exposure.`,
        tone: 'neutral',
      });
    }
  } else if (yearsToRetirement > 10) {
    if (equityDelta > 0.15) {
      insights.push({
        text: `**${(equityPct * 100).toFixed(0)}% equities** is aggressive for ${yearsToRetirement} years to retirement. A common guideline suggests closer to ${(suggestedEquity * 100).toFixed(0)}%.`,
        tone: 'caution',
      });
    } else {
      insights.push({
        text: `**${(equityPct * 100).toFixed(0)}% equities** is reasonable for your ${yearsToRetirement}-year horizon.`,
        tone: 'positive',
      });
    }
  } else {
    if (equityPct > 0.60) {
      insights.push({
        text: `With only ${yearsToRetirement} years to retirement, **${(equityPct * 100).toFixed(0)}% equities** carries meaningful volatility risk.`,
        tone: 'caution',
      });
    } else {
      insights.push({
        text: `**${(equityPct * 100).toFixed(0)}% equities** is appropriately conservative for ${yearsToRetirement} years out.`,
        tone: 'positive',
      });
    }
  }

  // 2. Diversification - geographic spread
  const geoCount = [canadianEquityPct, usPct, intlPct, emPct].filter((p) => p > 0.05).length;
  if (geoCount >= 3) {
    insights.push({
      text: `Spread across **${geoCount} equity regions** - good geographic diversification.`,
      tone: 'positive',
    });
  } else if (geoCount <= 1) {
    insights.push({
      text: `Equity exposure is concentrated in ${geoCount} region - consider broader diversification.`,
      tone: 'caution',
    });
  }

  // 3. Home bias check (Canadian equity > 35% of total equity)
  if (equityPct > 0 && canadianEquityPct / equityPct > 0.35) {
    const homeBiasPct = ((canadianEquityPct / equityPct) * 100).toFixed(0);
    insights.push({
      text: `Canadian stocks are **${homeBiasPct}%** of your equity. Canada is ~3% of global markets - this is a meaningful home bias.`,
      tone: 'neutral',
    });
  }

  // 4. Bond allocation context
  if (bondPct > 0 && bondPct < 0.10 && yearsToRetirement < 20) {
    insights.push({
      text: `Only **${(bondPct * 100).toFixed(0)}%** in bonds. As retirement approaches, fixed income helps cushion drawdowns.`,
      tone: 'caution',
    });
  } else if (bondPct >= 0.15 && yearsToRetirement > 25) {
    insights.push({
      text: `**${(bondPct * 100).toFixed(0)}% bonds** provides stability, though with ${yearsToRetirement} years ahead you could tolerate more growth.`,
      tone: 'neutral',
    });
  }

  // 5. Gold / alternatives
  if (goldPct > 0.02 && goldPct <= 0.15) {
    insights.push({
      text: `**${(goldPct * 100).toFixed(0)}% gold** adds an inflation hedge that's uncorrelated with equities.`,
      tone: 'positive',
    });
  } else if (goldPct > 0.15) {
    insights.push({
      text: `**${(goldPct * 100).toFixed(0)}% gold** is a large alternative allocation - gold doesn't generate income or dividends.`,
      tone: 'caution',
    });
  }

  return insights.slice(0, 3);
}

// ─────────────────────────────────────────────────────────────────────────────

const TONE_STYLES = {
  positive: 'text-ws-green',
  neutral: 'text-ws-text-secondary',
  caution: 'text-amber-600',
};

const TONE_DOT = {
  positive: 'bg-ws-green',
  neutral: 'bg-ws-text-tertiary',
  caution: 'bg-amber-500',
};

export default function PortfolioBreakdown() {
  const getAllocationSummary = useProfileStore((s) => s.getAllocationSummary);
  const profile = useProfileStore((s) => s.profile);
  const setChatPrompt = useSimulationStore((s) => s.setChatPrompt);

  const data = useMemo(() => getAllocationSummary(), [getAllocationSummary]);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  const insights = useMemo(
    () => generateInsights(data, profile.age, profile.retirementAge),
    [data, profile.age, profile.retirementAge]
  );

  return (
    <div className="px-5 py-4 border-t border-ws-border">
      <h4 className="text-sm font-medium text-ws-text-secondary mb-4">Portfolio Allocation</h4>

      <div className="flex items-center gap-6">
        {/* Donut */}
        <div className="w-[120px] h-[120px] flex-shrink-0 relative">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={36}
                outerRadius={55}
                dataKey="value"
                stroke="none"
                paddingAngle={2}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.colour} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-medium text-ws-text">{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.map((item, i) => (
            <motion.div
              key={item.assetClass}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.colour }}
                />
                <span className="text-ws-text-secondary">{item.label}</span>
              </div>
              <span className="text-ws-text font-medium">
                {(item.percentage * 100).toFixed(0)}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="mt-4 pt-3 border-t border-ws-border">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={10} className="text-ws-green" />
            <span className="text-xs font-medium text-ws-text-tertiary uppercase tracking-wider">
              Co-pilot insights
            </span>
          </div>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.1 }}
                className="flex gap-2 items-start"
              >
                <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${TONE_DOT[insight.tone]}`} />
                <p
                  className={`text-xs leading-relaxed ${TONE_STYLES[insight.tone]}`}
                  dangerouslySetInnerHTML={{
                    __html: insight.text
                      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>'),
                  }}
                />
              </motion.div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setChatPrompt('What do you think about my portfolio allocation?')}
            className="mt-2 text-sm text-ws-green hover:text-ws-green/80 transition-colors text-left font-medium"
          >
            Ask me about this &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
