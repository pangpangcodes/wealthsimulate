import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt } from '@/lib/claude/system-prompt';
import { CLAUDE_TOOLS } from '@/lib/claude/tools';
import type { FinancialProfile, ScenarioOverrides } from '@/lib/types';
import { solveForGoal, type SolvableVariable } from '@/lib/simulation/goal-solver';
import { runSensitivityAnalysis } from '@/lib/simulation/sensitivity';
import { validateProfileInputs } from '@/lib/simulation/limitations';

const anthropic = new Anthropic();

interface ScenarioSummaryPayload {
  name: string;
  retirementAnnualIncomeP50: number;
  incomeReplacementRatio: number;
  moneyLastsToAge: number;
  retirementNetWorthP50: number;
  retirementNetWorthP10: number;
  retirementNetWorthP90: number;
  cppOasAnnualIncome: number;
  worstCaseNetWorth: number;
  bestCaseNetWorth: number;
}

interface ChatRequest {
  messages: Anthropic.MessageParam[];
  profile: FinancialProfile;
  savedScenarioNames: string[];
  savedScenarioSummaries?: ScenarioSummaryPayload[];
  analysisDepth?: 'summary' | 'detailed';
}

// Check if the latest user message contains simulation results for analysis
function hasSimulationResults(messages: Anthropic.MessageParam[]): boolean {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (!lastUserMsg) return false;
  const content =
    typeof lastUserMsg.content === 'string'
      ? lastUserMsg.content
      : Array.isArray(lastUserMsg.content)
        ? lastUserMsg.content
            .filter((b): b is Anthropic.TextBlockParam => 'type' in b && b.type === 'text')
            .map((b) => b.text)
            .join('')
        : '';
  return content.includes('[SIMULATION_RESULTS]');
}

const ANALYSIS_PROMPT_SUFFIX = `

IMPORTANT: The user's latest message contains REAL simulation results with actual numbers.
You are now in Phase 2. You MUST:
1. Do NOT call any tools. You already have all the data you need in the message.
2. Cite the specific numbers from the results
3. Structure your response with exactly three sections: "**What the numbers show**", "**What this means for you**", "**What to explore next**"
4. If there is a COMPARISON VS BASELINE section, lead with the delta and explain what changed
5. Be specific and grounded - every claim should reference a number from the results
6. In "What to explore next", suggest 2-3 specific follow-up scenarios as questions the user could ask
7. If the results include a NEAR-TERM CASH FLOW section, you MUST address the immediate financial situation first before discussing retirement impact. Lead with the cash flow gap and liquid runway, then cover recovery options, then retirement.
8. NEVER reference "success rate" or "probability of ruin" - use retirement income, income replacement ratio, and how long the money lasts instead. Always mention CPP/OAS government pensions when discussing retirement income.`;

const SUMMARY_PROMPT_SUFFIX = `

IMPORTANT: The user's latest message contains REAL simulation results with actual numbers.
You are now in Phase 2. You MUST:
1. Do NOT call any tools. You already have all the data you need in the message.
2. Respond with ONLY ONE sentence - the single most important takeaway from the results. The user can read the full analysis in the results panel, so keep the chat response ultra-brief.
3. Cite 1-2 key numbers (e.g. retirement income, income replacement ratio, money lasts to age X). NEVER reference "success rate" - use income replacement and how long money lasts instead.
4. Do NOT use section headers, bullet points, or markdown formatting.
5. Do NOT suggest follow-up scenarios or next steps.
6. If there is a COMPARISON VS BASELINE section, state the single most significant change.
7. If the results include a NEAR-TERM CASH FLOW section, the one sentence should be about the immediate cash flow situation (monthly shortfall or runway), not retirement.
8. For disruptive scenarios (job loss, career gap), state the facts neutrally - no reassuring language like "very manageable" or "barely makes a dent".`;

export async function POST(request: NextRequest) {
  try {
    const body: ChatRequest = await request.json();
    const { messages, profile, savedScenarioNames, savedScenarioSummaries, analysisDepth } = body;

    let systemPrompt = buildSystemPrompt(profile);
    const isAnalysisRequest = hasSimulationResults(messages);

    // Add input validation flags if any profile values seem unrealistic
    const validationFlags = validateProfileInputs(profile);
    if (validationFlags.length > 0) {
      const flagText = validationFlags
        .map((f) => `- ${f.severity.toUpperCase()}: ${f.message}`)
        .join('\n');
      systemPrompt += `\n\n## Profile Validation Flags\nThe following profile values may need verification. Mention these gently if relevant to the user's question:\n${flagText}`;
    }

    // Inject existing scenario summaries so Claude knows what data is already available
    if (savedScenarioSummaries && savedScenarioSummaries.length > 0) {
      const scenarioLines = savedScenarioSummaries.map((s) =>
        `- "${s.name}": money lasts to age ${s.moneyLastsToAge}, retirement income $${Math.round(s.retirementAnnualIncomeP50).toLocaleString()}/yr, income replacement ${(s.incomeReplacementRatio * 100).toFixed(0)}%, retirement net worth $${Math.round(s.retirementNetWorthP50).toLocaleString()}`
      ).join('\n');
      systemPrompt += `\n\n## Existing Simulation Results\nThe following scenarios have ALREADY been run. If the user asks a general question about their retirement readiness (e.g. "Am I on track?", "How am I doing?"), answer using these existing results - do NOT run a new simulation. Only run a new simulation when the user asks a genuine "what if" with different parameters.\n${scenarioLines}`;
    }

    // If latest message has simulation results, append analysis instructions
    if (isAnalysisRequest) {
      systemPrompt += analysisDepth === 'summary' ? SUMMARY_PROMPT_SUFFIX : ANALYSIS_PROMPT_SUFFIX;
    }

    // Agentic loop: keep calling Claude until no more tool_use
    let currentMessages = [...messages];
    const toolResults: Array<{
      toolName: string;
      input: Record<string, unknown>;
      output: Record<string, unknown>;
    }> = [];
    let iterations = 0;
    const maxIterations = 5;

    // ── Agentic tool loop (non-streamed, fast) ──────────────────────────
    // Each iteration checks for tool_use. When tools are found, process
    // them and continue. When no tools, the text is the final response
    // but was fetched non-streamed, so we discard it and re-stream below.
    while (iterations < maxIterations) {
      iterations++;

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: systemPrompt,
        ...(isAnalysisRequest ? {} : { tools: CLAUDE_TOOLS }),
        messages: currentMessages,
      });

      const assistantContent: Anthropic.ContentBlock[] = response.content;
      const toolUseBlocks = assistantContent.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      );

      if (toolUseBlocks.length === 0) break; // No tools - stream final response below

      const toolUseResults: Anthropic.ToolResultBlockParam[] = [];
      for (const block of toolUseBlocks) {
        const validated = validateToolOutput(
          processToolCall(block.name, block.input as Record<string, unknown>, profile, savedScenarioNames, savedScenarioSummaries)
        );
        toolResults.push({ toolName: block.name, input: block.input as Record<string, unknown>, output: validated });
        toolUseResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(validated) });
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: toolUseResults },
      ];
    }

    // ── Stream the final text response ────────────────────────────────
    // If tools were used, currentMessages already has tool results appended
    // and we need a fresh call. If no tools, we re-stream the same call
    // (one wasted non-streamed call, but gives real streaming UX).
    const stream = anthropic.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: systemPrompt,
      // Don't offer tools on the final streaming call - we just want text
      messages: currentMessages,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (toolResults.length > 0) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'tool_results', toolResults })}\n\n`));
          }

          for await (const event of stream) {
            if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'delta', text: event.delta.text })}\n\n`));
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Stream error';
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
    });
  } catch (error) {
    console.error('Chat API error:', error);

    if (error instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `Claude API error: ${error.message}`, status: error.status },
        { status: error.status || 500 }
      );
    }

    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}

// ─── Tool Output Validation ──────────────────────────────────────────────────

function validateToolOutput(output: Record<string, unknown>): Record<string, unknown> {
  // Check for NaN or undefined values in numeric fields
  const warnings: string[] = [];
  for (const [key, value] of Object.entries(output)) {
    if (typeof value === 'number' && (isNaN(value) || !isFinite(value))) {
      warnings.push(`Field "${key}" has an invalid numeric value (${value})`);
      output[key] = 0; // Replace with 0 rather than passing garbage
    }
  }
  if (warnings.length > 0) {
    output._validation_warnings = warnings;
    output._validation_note = 'Some numeric values were invalid and replaced with 0. Treat these results with caution and inform the user that some calculations may not be reliable.';
  }
  return output;
}

// ─── Tool Call Processing ───────────────────────────────────────────────────

function processToolCall(
  toolName: string,
  input: Record<string, unknown>,
  profile: FinancialProfile,
  savedScenarioNames: string[],
  savedScenarioSummaries?: ScenarioSummaryPayload[]
): Record<string, unknown> {
  switch (toolName) {
    case 'run_simulation':
      return processRunSimulation(input, profile);

    case 'compare_scenarios':
      return processCompareScenarios(
        input as { scenario_names: string[] },
        savedScenarioNames
      );

    case 'synthesize_scenarios':
      return processSynthesizeScenarios(savedScenarioSummaries);

    case 'get_portfolio_summary':
      return processGetPortfolio(profile);

    case 'add_goal':
      return processAddGoal(input);

    case 'update_profile':
      return processUpdateProfile(input);

    case 'run_sensitivity_analysis':
      return processSensitivityAnalysis(profile);

    case 'reverse_engineer_goal':
      return processReverseEngineerGoal(input, profile);

    case 'explain_tradeoff':
      return {
        status: 'ready',
        option_a: input.option_a,
        option_b: input.option_b,
        context: input.context,
        note: 'Please provide your analysis based on the user profile and simulation capabilities.',
      };

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function processRunSimulation(
  input: Record<string, unknown>,
  profile: FinancialProfile
): Record<string, unknown> {
  // Build scenario overrides from tool input
  const scenario: ScenarioOverrides = {
    name: (input.scenario_name as string) || 'Custom Scenario',
  };

  if (input.retirement_age) scenario.retirementAge = input.retirement_age as number;
  if (input.annual_savings_rate) scenario.annualSavingsRate = input.annual_savings_rate as number;
  if (input.additional_income != null) scenario.additionalIncome = input.additional_income as number;
  if (input.inflation_rate != null) scenario.inflationRate = input.inflation_rate as number;
  if (input.life_expectancy) scenario.lifeExpectancy = input.life_expectancy as number;
  if (input.desired_retirement_income) scenario.desiredRetirementIncome = input.desired_retirement_income as number;

  if (input.home_purchase_year) {
    scenario.homePurchase = {
      year: input.home_purchase_year as number,
      price: (input.home_purchase_price as number) || 500000,
      downPaymentPercent: (input.home_down_payment_percent as number) || 0.10,
    };
  }

  if (input.child_year) {
    scenario.children = [{
      year: input.child_year as number,
      annualCostIncrease: (input.child_annual_cost as number) || 18000,
    }];
  }

  if (input.career_change_year) {
    scenario.careerChange = {
      year: input.career_change_year as number,
      newIncome: (input.career_new_income as number) ?? profile.annualIncome,
      gapMonths: (input.career_gap_months as number) ?? 3,
    };
  }

  if (input.market_crash_year) {
    scenario.marketCrash = {
      year: input.market_crash_year as number,
      severity: (input.market_crash_severity as 'mild' | 'moderate' | 'severe') || 'moderate',
    };
  }

  if (input.contribution_timing) {
    scenario.contributionTiming = input.contribution_timing as 'annual' | 'monthly';
  }

  // Return the scenario config for the frontend to execute
  // The actual simulation runs CLIENT-SIDE in a Web Worker
  return {
    status: 'simulation_requested',
    scenario,
    message: `Simulation "${scenario.name}" has been queued and will run on the user's device. Results will appear in the dashboard chart.`,
    important: 'You do NOT have the simulation results. The simulation has not run yet - it will execute client-side after your response. Do NOT quote any specific dollar amounts, percentages, or success rates. Instead, describe the scenario qualitatively and tell the user to check the dashboard for exact numbers.',
  };
}

function processCompareScenarios(
  input: { scenario_names: string[] },
  savedScenarioNames: string[]
): Record<string, unknown> {
  const requested = input.scenario_names || [];
  const available = savedScenarioNames;
  const found = requested.filter((name) =>
    available.some((saved) => saved.toLowerCase().includes(name.toLowerCase()))
  );
  const notFound = requested.filter(
    (name) => !available.some((saved) => saved.toLowerCase().includes(name.toLowerCase()))
  );

  return {
    status: 'comparison_requested',
    found_scenarios: found,
    not_found_scenarios: notFound,
    available_scenarios: available,
    message:
      found.length >= 2
        ? `Comparing ${found.length} scenarios. Results will appear in the dashboard.`
        : `Need at least 2 scenarios to compare. Available: ${available.join(', ')}`,
    important: 'You do NOT have comparison results. Do NOT invent specific dollar amounts or percentages. Tell the user to check the dashboard for the comparison.',
  };
}

function processGetPortfolio(profile: FinancialProfile): Record<string, unknown> {
  const allocationByClass: Record<string, number> = {};
  const allocationByType: Record<string, number> = {};

  for (const account of profile.accounts) {
    allocationByType[account.type] =
      (allocationByType[account.type] || 0) + account.marketValue;

    for (const holding of account.holdings) {
      allocationByClass[holding.assetClass] =
        (allocationByClass[holding.assetClass] || 0) + holding.marketValue;
    }
  }

  // Convert to percentages
  const total = profile.totalNetWorth;
  const classBreakdown = Object.entries(allocationByClass).map(([cls, val]) => ({
    assetClass: cls,
    value: val,
    percentage: ((val / total) * 100).toFixed(1) + '%',
  }));

  const typeBreakdown = Object.entries(allocationByType).map(([type, val]) => ({
    accountType: type,
    value: val,
    percentage: ((val / total) * 100).toFixed(1) + '%',
  }));

  return {
    totalNetWorth: total,
    byAssetClass: classBreakdown,
    byAccountType: typeBreakdown,
    accounts: profile.accounts.map((a) => ({
      name: a.name,
      type: a.type,
      value: a.marketValue,
      holdings: a.holdings.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        assetClass: h.assetClass,
        value: h.marketValue,
      })),
    })),
  };
}

function processAddGoal(input: Record<string, unknown>): Record<string, unknown> {
  return {
    status: 'goal_added',
    goal: {
      id: `goal-${Date.now()}`,
      type: input.goal_type,
      name: input.name,
      targetAmount: input.target_amount,
      targetYear: input.target_year,
      priority: input.priority,
    },
    message: `Goal "${input.name}" has been added to your profile.`,
  };
}

function processUpdateProfile(input: Record<string, unknown>): Record<string, unknown> {
  const field = input.field as string;
  const value = input.string_value || input.value;

  return {
    status: 'profile_updated',
    field,
    newValue: value,
    message: `Profile field "${field}" has been updated to ${value}.`,
  };
}

function processSynthesizeScenarios(
  summaries?: ScenarioSummaryPayload[]
): Record<string, unknown> {
  if (!summaries || summaries.length < 3) {
    return {
      status: 'error',
      message: `Need at least 3 saved scenarios for synthesis. Currently have ${summaries?.length ?? 0}.`,
    };
  }

  const fmtMoney = (val: number): string => {
    const abs = Math.abs(val);
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `$${(abs / 1_000).toFixed(0)}K`;
    return `$${abs.toFixed(0)}`;
  };

  // Find best/worst by key metrics
  const byIncome = [...summaries].sort((a, b) => b.retirementAnnualIncomeP50 - a.retirementAnnualIncomeP50);
  const byMoneyLasts = [...summaries].sort((a, b) => b.moneyLastsToAge - a.moneyLastsToAge);
  const byNetWorth = [...summaries].sort((a, b) => b.retirementNetWorthP50 - a.retirementNetWorthP50);

  // Find the scenario with the largest worst-case gap (risk asymmetry)
  const byWorstCase = [...summaries].sort((a, b) => {
    const aGap = a.retirementNetWorthP50 - a.retirementNetWorthP10;
    const bGap = b.retirementNetWorthP50 - b.retirementNetWorthP10;
    return bGap - aGap;
  });

  // Check for dominance: any scenario that's better in EVERY metric?
  const dominanceChecks: string[] = [];
  for (const a of summaries) {
    for (const b of summaries) {
      if (a.name === b.name) continue;
      const aDominates =
        a.retirementAnnualIncomeP50 >= b.retirementAnnualIncomeP50 &&
        a.moneyLastsToAge >= b.moneyLastsToAge &&
        a.retirementNetWorthP50 >= b.retirementNetWorthP50 &&
        a.incomeReplacementRatio >= b.incomeReplacementRatio;
      if (aDominates) {
        dominanceChecks.push(`"${a.name}" dominates "${b.name}" (better in every metric)`);
      }
    }
  }

  return {
    status: 'synthesis_complete',
    scenario_count: summaries.length,
    scenarios: summaries.map((s) => ({
      name: s.name,
      retirement_income: fmtMoney(s.retirementAnnualIncomeP50),
      income_replacement: `${Math.round(s.incomeReplacementRatio * 100)}%`,
      money_lasts_to: `Age ${s.moneyLastsToAge}`,
      retirement_net_worth: fmtMoney(s.retirementNetWorthP50),
      worst_case_net_worth: fmtMoney(s.worstCaseNetWorth),
    })),
    best_retirement_income: { scenario: byIncome[0].name, value: fmtMoney(byIncome[0].retirementAnnualIncomeP50) },
    worst_retirement_income: { scenario: byIncome[byIncome.length - 1].name, value: fmtMoney(byIncome[byIncome.length - 1].retirementAnnualIncomeP50) },
    best_money_lasts: { scenario: byMoneyLasts[0].name, value: `Age ${byMoneyLasts[0].moneyLastsToAge}` },
    worst_money_lasts: { scenario: byMoneyLasts[byMoneyLasts.length - 1].name, value: `Age ${byMoneyLasts[byMoneyLasts.length - 1].moneyLastsToAge}` },
    highest_risk_asymmetry: {
      scenario: byWorstCase[0].name,
      p50: fmtMoney(byWorstCase[0].retirementNetWorthP50),
      p10: fmtMoney(byWorstCase[0].retirementNetWorthP10),
      gap: fmtMoney(byWorstCase[0].retirementNetWorthP50 - byWorstCase[0].retirementNetWorthP10),
    },
    dominance: dominanceChecks.length > 0 ? dominanceChecks : ['No scenario dominates another completely'],
    important: 'You MUST cite exact numbers from each scenario when presenting this synthesis. Never generalize or approximate. Reference specific scenario names and their metrics.',
  };
}

function processSensitivityAnalysis(
  profile: FinancialProfile
): Record<string, unknown> {
  try {
    const result = runSensitivityAnalysis(profile, { name: 'Sensitivity' }, 100);

    const fmtDelta = (val: number, metric: string): string => {
      const sign = val >= 0 ? '+' : '';
      if (metric === 'Money Lasts To') return `${sign}${val.toFixed(0)} years`;
      if (metric === 'Income Replacement') return `${sign}${(val * 100).toFixed(0)} percentage points`;
      const abs = Math.abs(val);
      const s = val < 0 ? '-' : '+';
      if (abs >= 1_000_000) return `${s}$${(abs / 1_000_000).toFixed(1)}M`;
      if (abs >= 1_000) return `${s}$${(abs / 1_000).toFixed(0)}K`;
      return `${s}$${abs.toFixed(0)}`;
    };

    return {
      status: 'sensitivity_complete',
      ranked_variables: result.variables.map((v) => ({
        variable: v.label,
        perturbation: v.perturbation,
        metric: v.metric,
        low_delta: fmtDelta(v.lowDelta, v.metric),
        high_delta: fmtDelta(v.highDelta, v.metric),
        max_impact: fmtDelta(v.maxAbsDelta, v.metric),
      })),
      most_impactful: result.variables[0]?.label ?? 'Unknown',
      paths_per_run: result.pathsPerRun,
      important: 'Report the EXACT deltas for each variable. The variables are sorted by impact magnitude. Cite exact numbers, never approximate.',
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Sensitivity analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

function processReverseEngineerGoal(
  input: Record<string, unknown>,
  profile: FinancialProfile
): Record<string, unknown> {
  try {
    const variable = input.variable as SolvableVariable;
    const targetAge = input.target_age as number | undefined;

    const result = solveForGoal({
      variable,
      profile,
      scenario: { name: 'Goal Solver' },
      targetAge,
    });

    // Format for clear AI presentation
    const variableLabels: Record<SolvableVariable, string> = {
      savings_rate: 'savings rate',
      retirement_age: 'retirement age',
      desired_retirement_income: 'annual retirement income',
    };

    const formatValue = (v: SolvableVariable, val: number): string => {
      if (v === 'savings_rate') return `${(val * 100).toFixed(1)}%`;
      if (v === 'retirement_age') return `age ${Math.round(val)}`;
      return `$${Math.round(val).toLocaleString()}/year`;
    };

    return {
      status: 'goal_solved',
      variable: variableLabels[variable],
      solved_value: result.solvedValue,
      solved_value_formatted: formatValue(variable, result.solvedValue),
      current_value: result.currentValue,
      current_value_formatted: formatValue(variable, result.currentValue),
      money_lasts_to_age: result.moneyLastsToAge,
      target_age: targetAge ?? profile.lifeExpectancy,
      converged: result.converged,
      iterations: result.iterations,
      retirement_annual_income: Math.round(result.summary.retirementAnnualIncomeP50),
      income_replacement_ratio: Math.round(result.summary.incomeReplacementRatio * 100),
      retirement_net_worth: Math.round(result.summary.retirementNetWorthP50),
      cpp_oas_annual: Math.round(result.summary.cppOasAnnualIncome),
      important: 'You MUST report the exact solved_value_formatted. Do NOT round, approximate, or "clean up" this number. It was computed by binary search over real simulation runs.',
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Goal solver failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}
