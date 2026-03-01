'use client';

import { useMemo, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Line,
  ComposedChart,
} from 'recharts';
import type { SimulationResults } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';

// ── Colour palette ──────────────────────────────────────────────────────────
export const POSITIVE_COLOURS = ['#06b583', '#3b82f6', '#8b5cf6'];   // green, blue, purple
export const NEGATIVE_COLOURS = ['#e85454', '#f5a623', '#c084fc'];     // red, amber, light purple
export const BASELINE_COLOUR = '#9b9b9b';

interface NetWorthTimelineProps {
  results?: SimulationResults | null;        // existing (for compact/modal usage)
  scenarios?: SimulationResults[];            // multi-overlay mode
  activeScenarioId?: string | null;
  onActiveChange?: (id: string) => void;
  isSimulating?: boolean;
  compact?: boolean;
  hideLegend?: boolean;
}

type TimeRange = '10Y' | '20Y' | '30Y' | 'ALL';

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

/** Round up to a sensible Y-axis ceiling that doesn't leave excessive headroom. */
function ceilYAxis(raw: number): number {
  if (raw <= 0) return 10_000;
  const padded = raw * 1.15;
  // Pick a rounding increment proportional to value
  let step: number;
  if (padded < 50_000) step = 10_000;
  else if (padded < 200_000) step = 25_000;
  else if (padded < 500_000) step = 50_000;
  else if (padded < 2_000_000) step = 100_000;
  else step = 500_000;
  return Math.ceil(padded / step) * step;
}

// ── Single-scenario tooltip (compact/modal mode) ────────────────────────────
const SingleTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; dataKey: string; payload?: { year: string; age: number } }> }) => {
  if (!active || !payload?.length) return null;

  const p50 = payload.find((p) => p.dataKey === 'p50');
  const p90 = payload.find((p) => p.dataKey === 'p90');
  const p10 = payload.find((p) => p.dataKey === 'p10');
  const row = payload[0]?.payload;

  return (
    <div className="bg-white border border-ws-border rounded-xl px-4 py-3 shadow-lg">
      <p className="text-sm text-ws-text-tertiary mb-1.5">
        {row?.year} <span className="text-ws-text-secondary">(age {row?.age})</span>
      </p>
      {p90 && (
        <p className="text-sm text-ws-green">
          Best case: <span className="font-medium">{formatCurrency(p90.value)}</span>
        </p>
      )}
      {p50 && (
        <p className="text-base font-semibold text-ws-text">
          Most likely: {formatCurrency(p50.value)}
        </p>
      )}
      {p10 && (
        <p className="text-sm text-ws-yellow">
          Worst case: <span className="font-medium">{formatCurrency(p10.value)}</span>
        </p>
      )}
    </div>
  );
};

// ── Multi-scenario tooltip ──────────────────────────────────────────────────
interface MultiTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: any[];
  scenarioMeta: { key: string; name: string; colour: string; isBaseline: boolean }[];
}

const MultiTooltip = ({ active, payload, scenarioMeta }: MultiTooltipProps) => {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  // Gather all scenario p50 values, sorted descending
  const entries = scenarioMeta
    .map((m) => ({
      name: m.name,
      colour: m.colour,
      value: row[m.key] as number | undefined,
    }))
    .filter((e) => e.value !== undefined && e.value !== null)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="bg-white border border-ws-border rounded-xl px-4 py-3 shadow-lg min-w-[160px]">
      <p className="text-sm text-ws-text-tertiary mb-1.5">
        {row.year} <span className="text-ws-text-secondary">(age {row.age})</span>
      </p>
      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.name} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: e.colour }}
            />
            <span className="text-ws-text-secondary truncate">{e.name}</span>
            <span className="font-medium text-ws-text ml-auto">{formatCurrency(e.value!)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Main component ──────────────────────────────────────────────────────────
export default function NetWorthTimeline({
  results,
  scenarios,
  activeScenarioId,
  onActiveChange,
  isSimulating,
  compact,
  hideLegend,
}: NetWorthTimelineProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('ALL');

  // Determine mode: multi-scenario overlay vs single-scenario (compact/modal)
  const isMultiMode = !compact && scenarios && scenarios.length > 0;

  // ── Single-scenario data (compact/modal mode) ──────────────────────────
  const singleResults = results ?? null;
  const singleChartData = useMemo(() => {
    if (isMultiMode || !singleResults) return [];
    let data = singleResults.yearlyData.map((d) => ({
      year: d.year.toString(),
      label: `${d.year}`,
      age: d.age,
      p10: Math.max(0, d.p10),
      p25: Math.max(0, d.p25),
      p50: Math.max(0, d.p50),
      p75: Math.max(0, d.p75),
      p90: Math.max(0, d.p90),
    }));
    const yearsToShow = timeRange === '10Y' ? 10 : timeRange === '20Y' ? 20 : timeRange === '30Y' ? 30 : data.length;
    data = data.slice(0, yearsToShow);
    return data;
  }, [isMultiMode, singleResults, timeRange]);

  const singleYAxisMax = useMemo(() => {
    if (singleChartData.length === 0) return undefined;
    const maxP75 = Math.max(...singleChartData.map((d) => d.p75));
    return ceilYAxis(maxP75);
  }, [singleChartData]);

  // ── Multi-scenario data ────────────────────────────────────────────────
  const baseline = useMemo(
    () => scenarios?.find((s) => s.scenarioName === 'Current Path') ?? null,
    [scenarios]
  );

  const activeScenario = useMemo(
    () => scenarios?.find((s) => s.id === activeScenarioId) ?? null,
    [scenarios, activeScenarioId]
  );

  // Assign stable colours: baseline = grey, others get positive/negative colours
  const scenarioMeta = useMemo(() => {
    if (!scenarios) return [];
    const baselineResult = scenarios.find((s) => s.scenarioName === 'Current Path');
    const baselineNW = baselineResult?.summary.retirementNetWorthP50 ?? 0;
    let posIdx = 0;
    let negIdx = 0;
    return scenarios.map((s) => {
      const isBaseline = s.scenarioName === 'Current Path';
      const isActive = s.id === activeScenarioId;
      let colour: string;
      if (isBaseline) {
        colour = BASELINE_COLOUR;
      } else {
        const isWorse = s.summary.retirementNetWorthP50 < baselineNW;
        colour = isWorse
          ? NEGATIVE_COLOURS[negIdx++ % NEGATIVE_COLOURS.length]
          : POSITIVE_COLOURS[posIdx++ % POSITIVE_COLOURS.length];
      }
      return {
        id: s.id,
        name: s.scenarioName,
        key: `s_${s.id}`,
        colour,
        isBaseline,
        isActive,
      };
    });
  }, [scenarios, activeScenarioId]);

  // Build merged chart data keyed by year
  const multiChartData = useMemo(() => {
    if (!isMultiMode || !scenarios || scenarios.length === 0) return [];

    // Use the first scenario's yearlyData as the backbone for year/age
    const maxLen = Math.max(...scenarios.map((s) => s.yearlyData.length));
    const backbone = scenarios.reduce((best, s) =>
      s.yearlyData.length >= best.yearlyData.length ? s : best
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged: Record<string, any>[] = [];

    for (let i = 0; i < maxLen; i++) {
      const base = backbone.yearlyData[i];
      if (!base) continue;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row: Record<string, any> = {
        year: base.year.toString(),
        age: base.age,
      };

      for (const s of scenarios) {
        const d = s.yearlyData[i];
        if (!d) continue;
        const key = `s_${s.id}`;
        row[key] = Math.max(0, d.p50);

        // Fan bands only for baseline and active scenario
        const isBaseline = s.scenarioName === 'Current Path';
        const isActive = s.id === activeScenarioId;
        if (isBaseline || isActive) {
          row[`${key}_p10`] = Math.max(0, d.p10);
          row[`${key}_p25`] = Math.max(0, d.p25);
          row[`${key}_p75`] = Math.max(0, d.p75);
          row[`${key}_p90`] = Math.max(0, d.p90);
        }
      }

      merged.push(row);
    }

    // Trim trailing zeros: find the last year where any scenario > 0, keep a small buffer
    let lastNonZeroIdx = 0;
    for (let i = 0; i < merged.length; i++) {
      for (const s of scenarios!) {
        const v = merged[i][`s_${s.id}`] as number | undefined;
        if (v && v > 0) lastNonZeroIdx = i;
      }
    }
    // Keep 3 extra years past the last non-zero point so the drop-off is visible
    const trimmedEnd = Math.min(merged.length, lastNonZeroIdx + 4);
    let data = merged.slice(0, trimmedEnd);

    // Time range filter (applied after trimming)
    const yearsToShow = timeRange === '10Y' ? 10 : timeRange === '20Y' ? 20 : timeRange === '30Y' ? 30 : data.length;
    data = data.slice(0, yearsToShow);

    return data;
  }, [isMultiMode, scenarios, activeScenarioId, timeRange]);

  // Y-axis max across all visible scenarios (p50 lines only, not p90 outliers)
  const multiYAxisMax = useMemo(() => {
    if (multiChartData.length === 0) return undefined;
    let maxVal = 0;
    for (const row of multiChartData) {
      for (const meta of scenarioMeta) {
        const v = row[meta.key] as number | undefined;
        if (v && v > maxVal) maxVal = v;
      }
    }
    return ceilYAxis(maxVal) || undefined;
  }, [multiChartData, scenarioMeta]);

  // Retirement reference line
  const retirementAge = isMultiMode
    ? (activeScenario?.config.scenario.retirementAge ?? activeScenario?.config.profile.retirementAge ??
       baseline?.config.scenario.retirementAge ?? baseline?.config.profile.retirementAge)
    : (singleResults?.config.scenario.retirementAge ?? singleResults?.config.profile.retirementAge);

  const retirementYear = useMemo(() => {
    const src = isMultiMode ? (activeScenario ?? baseline) : singleResults;
    if (!retirementAge || !src) return undefined;
    return (src.config.startYear + (retirementAge - src.config.profile.age)).toString();
  }, [isMultiMode, activeScenario, baseline, singleResults, retirementAge]);

  // Single-mode header data
  const retirementP50 = singleResults?.yearlyData.find(
    (d) => d.age === retirementAge
  )?.p50 ?? singleResults?.yearlyData[singleResults.yearlyData.length - 1]?.p50 ?? 0;
  const startP50 = singleResults?.yearlyData[0]?.p50 ?? 0;
  const totalGrowth = startP50 > 0 ? ((retirementP50 - startP50) / startP50) * 100 : 0;
  const moneyLastsToAge = singleResults?.summary.moneyLastsToAge ?? 0;
  const lifeExpectancy = singleResults?.config.profile.lifeExpectancy ?? 90;
  const depletionAge = retirementP50 <= 0 && moneyLastsToAge < lifeExpectancy
    ? moneyLastsToAge
    : null;

  const handleLegendClick = useCallback(
    (id: string) => {
      onActiveChange?.(id);
    },
    [onActiveChange]
  );

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Header - single-scenario mode only (compact hides it) */}
      {!compact && !isMultiMode && (
        <div className="mb-6">
          <AnimatePresence mode="wait">
            {singleResults && (
              <motion.div
                key={singleResults.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="text-4xl font-light text-ws-text tracking-tight">
                  {formatCurrency(retirementP50)}
                </p>
                {depletionAge && depletionAge < (retirementAge ?? Infinity) ? (
                  <p className="text-base mt-1 text-ws-red">
                    Portfolio depletes around age {depletionAge}
                  </p>
                ) : (
                  <p className={`text-base mt-1 ${totalGrowth >= 0 ? 'text-ws-green' : 'text-ws-red'}`}>
                    {totalGrowth >= 0 ? '+' : ''}{totalGrowth.toFixed(1)}% projected growth by age {retirementAge}
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {!singleResults && !isSimulating && (
            <div>
              <p className="text-4xl font-light text-ws-text-tertiary tracking-tight">-</p>
              <p className="text-base text-ws-text-tertiary mt-1">Run a simulation to see projections</p>
            </div>
          )}

          {isSimulating && (
            <div className="animate-pulse">
              <div className="h-10 w-48 bg-ws-border rounded-lg" />
              <div className="h-4 w-64 bg-ws-border rounded mt-2" />
            </div>
          )}
        </div>
      )}

      {/* Legend - multi-mode only (hidden when parent provides its own) */}
      {isMultiMode && !hideLegend && scenarioMeta.length > 1 && (
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          {scenarioMeta.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => handleLegendClick(m.id)}
              className={`flex items-center gap-1.5 text-xs transition-colors ${
                m.isActive ? 'text-ws-text font-medium' : 'text-ws-text-tertiary hover:text-ws-text-secondary'
              }`}
            >
              {m.isBaseline ? (
                <svg width="12" height="2" className="flex-shrink-0">
                  <line x1="0" y1="1" x2="12" y2="1" stroke={m.colour} strokeWidth="2" strokeDasharray="3 2" />
                </svg>
              ) : (
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: m.colour }}
                />
              )}
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className={`${compact ? 'h-[200px]' : 'h-[300px]'} -mx-2`}>
        {isMultiMode && multiChartData.length > 0 ? (
          /* ── Multi-scenario chart ────────────────────────────────────── */
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={multiChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                {/* Fan band gradients for active non-baseline scenario */}
                {scenarioMeta.filter((m) => m.isActive && !m.isBaseline).map((m) => (
                  <linearGradient key={`grad_${m.id}`} id={`gradActive_${m.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={m.colour} stopOpacity={0.18} />
                    <stop offset="100%" stopColor={m.colour} stopOpacity={0.04} />
                  </linearGradient>
                ))}
                {/* Baseline fan gradient */}
                <linearGradient id="gradBaseline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BASELINE_COLOUR} stopOpacity={0.10} />
                  <stop offset="100%" stopColor={BASELINE_COLOUR} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="year"
                tick={false}
                axisLine={false}
                tickLine={false}
                height={0}
              />
              <XAxis
                dataKey="year"
                xAxisId="display"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tick={(props: Record<string, unknown>) => {
                  const x = Number(props.x);
                  const y = Number(props.y);
                  const payload = props.payload as { value: string; index: number };
                  const dataPoint = multiChartData[payload.index];
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={12} textAnchor="middle" fill="#9b9b9b" fontSize={13}>
                        {payload.value}
                      </text>
                      <text x={0} y={0} dy={24} textAnchor="middle" fill="#c4c4c4" fontSize={11}>
                        age {dataPoint?.age}
                      </text>
                    </g>
                  );
                }}
                height={36}
              />
              <YAxis
                tick={{ fontSize: 13, fill: '#9b9b9b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCurrency}
                width={60}
                domain={[0, multiYAxisMax ?? 'auto']}
                allowDataOverflow
              />

              <Tooltip
                content={<MultiTooltip scenarioMeta={scenarioMeta.map((m) => ({ key: m.key, name: m.name, colour: m.colour, isBaseline: m.isBaseline }))} />}
              />

              {retirementYear && (
                <ReferenceLine
                  x={retirementYear}
                  stroke="#e8e6e3"
                  strokeDasharray="4 4"
                  label={{
                    value: `Retirement (${retirementAge})`,
                    position: 'insideTopRight',
                    fill: '#9b9b9b',
                    fontSize: 12,
                  }}
                />
              )}

              {/* Fan bands: baseline (subtle grey) */}
              {baseline && scenarioMeta.find((m) => m.isBaseline) && (
                <>
                  <Area
                    type="monotone"
                    dataKey={`s_${baseline.id}_p10`}
                    stroke="none"
                    fill="url(#gradBaseline)"
                    fillOpacity={1}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey={`s_${baseline.id}_p90`}
                    stroke="none"
                    fill="url(#gradBaseline)"
                    fillOpacity={1}
                    isAnimationActive={false}
                  />
                </>
              )}

              {/* Fan bands: active non-baseline scenario */}
              {activeScenario && activeScenario.scenarioName !== 'Current Path' && (
                <>
                  <Area
                    type="monotone"
                    dataKey={`s_${activeScenario.id}_p10`}
                    stroke="none"
                    fill={`url(#gradActive_${activeScenario.id})`}
                    fillOpacity={1}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey={`s_${activeScenario.id}_p90`}
                    stroke="none"
                    fill={`url(#gradActive_${activeScenario.id})`}
                    fillOpacity={1}
                    isAnimationActive={false}
                  />
                </>
              )}

              {/* P50 lines: render inactive first, then active on top */}
              {scenarioMeta
                .slice()
                .sort((a, b) => (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0))
                .map((m) => (
                <Line
                  key={m.id}
                  type="monotone"
                  dataKey={m.key}
                  stroke={m.colour}
                  strokeWidth={m.isActive ? 2.5 : 1.5}
                  strokeDasharray={m.isBaseline ? '6 3' : undefined}
                  strokeOpacity={m.isActive || m.isBaseline ? 1 : 0.35}
                  dot={false}
                  activeDot={m.isActive ? { r: 4, fill: m.colour, stroke: '#fff', strokeWidth: 2 } : false}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        ) : singleChartData.length > 0 ? (
          /* ── Single-scenario chart (compact/modal) ───────────────────── */
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={singleChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gradP90" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b583" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#06b583" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradP75" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b583" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#06b583" stopOpacity={0.04} />
                </linearGradient>
                <linearGradient id="gradP25" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f5a623" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#f5a623" stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="year"
                tick={false}
                axisLine={false}
                tickLine={false}
                height={0}
              />
              <XAxis
                dataKey="year"
                xAxisId="display"
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                tick={(props: Record<string, unknown>) => {
                  const x = Number(props.x);
                  const y = Number(props.y);
                  const payload = props.payload as { value: string; index: number };
                  const dataPoint = singleChartData[payload.index];
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={12} textAnchor="middle" fill="#9b9b9b" fontSize={13}>
                        {payload.value}
                      </text>
                      <text x={0} y={0} dy={24} textAnchor="middle" fill="#c4c4c4" fontSize={11}>
                        age {dataPoint?.age}
                      </text>
                    </g>
                  );
                }}
                height={36}
              />
              <YAxis
                tick={{ fontSize: 13, fill: '#9b9b9b' }}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatCurrency}
                width={60}
                domain={[0, singleYAxisMax ?? 'auto']}
                allowDataOverflow
              />

              <Tooltip content={<SingleTooltip />} />

              {retirementYear && (
                <ReferenceLine
                  x={retirementYear}
                  stroke="#e8e6e3"
                  strokeDasharray="4 4"
                  label={{
                    value: `Retirement (${retirementAge})`,
                    position: 'insideTopRight',
                    fill: '#9b9b9b',
                    fontSize: 12,
                  }}
                />
              )}

              {/* P10-P25 band (conservative) */}
              <Area
                type="monotone"
                dataKey="p10"
                stroke="none"
                fill="url(#gradP25)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="p25"
                stroke="none"
                fill="url(#gradP75)"
                fillOpacity={1}
              />

              {/* P75-P90 band (optimistic) */}
              <Area
                type="monotone"
                dataKey="p75"
                stroke="none"
                fill="url(#gradP75)"
                fillOpacity={1}
              />
              <Area
                type="monotone"
                dataKey="p90"
                stroke="none"
                fill="url(#gradP90)"
                fillOpacity={1}
              />

              {/* P50 median line */}
              <Area
                type="monotone"
                dataKey="p50"
                stroke="#06b583"
                strokeWidth={2}
                fill="none"
                dot={false}
                activeDot={{ r: 4, fill: '#06b583', stroke: '#fff', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center">
            {isSimulating ? (
              <div className="text-center space-y-2">
                <div className="w-8 h-8 border-2 border-ws-green border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-base text-ws-text-tertiary">Exploring 1,000 possible futures...</p>
              </div>
            ) : (
              <div className="w-full h-full bg-gradient-to-t from-ws-border/20 to-transparent rounded-lg" />
            )}
          </div>
        )}
      </div>

      {/* Time range tabs */}
      <div className={`flex items-center gap-1 ${compact ? 'mt-2' : 'mt-4'}`}>
        {(['10Y', '20Y', '30Y', 'ALL'] as TimeRange[]).map((range) => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-3 py-1 text-sm rounded-full transition-colors ${
              timeRange === range
                ? 'bg-ws-black text-white'
                : 'text-ws-text-secondary hover:bg-ws-hover'
            }`}
          >
            {range}
          </button>
        ))}
      </div>
    </div>
  );
}
