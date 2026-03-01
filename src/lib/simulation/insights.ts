import type { SimulationResults, FinancialProfile, ScenarioOverrides } from '@/lib/types';
import type { AssetClass } from '@/lib/types';
import { ASSET_CLASS_PARAMS } from './distributions';
import { ANNUAL_FEE_RATE } from './engine';
import { estimateMarginalRate, calculateIncomeTax, CONTRIBUTION_LIMITS } from './canadian-tax';
import { GIS_INCOME_THRESHOLD_SINGLE } from './government-pensions';

export interface Insight {
  label: string;
  detail: string;
}

export type VerdictSeverity = 'green' | 'amber' | 'red';

export interface Verdict {
  message: string;
  severity: VerdictSeverity;
  subtext: string;
  chatPrompt?: string;
}

export interface PhasedInsights {
  accumulation: Insight[];
  drawdown: Insight[];
  impacts: Insight[];
}

// ─── Scenario-Aware Types ──────────────────────────────────────────────────

export type ScenarioFocus = 'home-purchase' | 'career-gap' | 'children' | 'market-crash'
  | 'retirement-age' | 'savings-change' | 'contribution-timing' | 'retirement';

export interface MetricCardData {
  label: string;
  value: string;
  subtext?: string;
  severity?: 'green' | 'amber' | 'red';
  delta?: { label: string; positive: boolean };
}

function fmtK(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function fmtWhole(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(0)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

function computeWeightedReturn(
  accounts: { holdings: { assetClass: AssetClass; allocation: number }[]; marketValue: number }[]
): number {
  const totalValue = accounts.reduce((s, a) => s + a.marketValue, 0);
  if (totalValue === 0) {
    // Fallback balanced: 40% CA equity, 30% US equity, 30% CA bonds
    return (
      0.4 * ASSET_CLASS_PARAMS['canadian-equity'].expectedReturn +
      0.3 * ASSET_CLASS_PARAMS['us-equity'].expectedReturn +
      0.3 * ASSET_CLASS_PARAMS['canadian-bonds'].expectedReturn
    );
  }

  let weightedReturn = 0;
  for (const account of accounts) {
    const accountWeight = account.marketValue / totalValue;
    if (account.holdings.length > 0) {
      for (const h of account.holdings) {
        const params = ASSET_CLASS_PARAMS[h.assetClass];
        if (params) {
          weightedReturn += accountWeight * h.allocation * params.expectedReturn;
        }
      }
    } else {
      // Fallback balanced for accounts with no holdings
      const fallback =
        0.4 * ASSET_CLASS_PARAMS['canadian-equity'].expectedReturn +
        0.3 * ASSET_CLASS_PARAMS['us-equity'].expectedReturn +
        0.3 * ASSET_CLASS_PARAMS['canadian-bonds'].expectedReturn;
      weightedReturn += accountWeight * fallback;
    }
  }
  return weightedReturn;
}

function mortgagePayment(principal: number, annualRate: number, years: number): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  return (
    (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1)
  );
}

// ─── Scenario Detection ────────────────────────────────────────────────────

export function detectScenarioFocus(
  scenario: ScenarioOverrides,
  profile: FinancialProfile
): ScenarioFocus {
  // Priority order: home-purchase > career-gap > children > market-crash >
  // retirement-age > savings-change > contribution-timing > retirement
  if (scenario.homePurchase) return 'home-purchase';
  if (scenario.careerChange && scenario.careerChange.gapMonths > 0) return 'career-gap';
  if (scenario.children && scenario.children.length > 0) return 'children';
  if (scenario.marketCrash) return 'market-crash';
  if (scenario.retirementAge !== undefined && scenario.retirementAge !== profile.retirementAge) return 'retirement-age';
  if (scenario.annualSavingsRate !== undefined && scenario.annualSavingsRate !== profile.annualSavingsRate) return 'savings-change';
  if (scenario.contributionTiming === 'monthly') return 'contribution-timing';
  return 'retirement';
}

// ─── Scenario-Aware Metric Cards ───────────────────────────────────────────

export function generateMetricCards(
  results: SimulationResults,
  baseline?: SimulationResults | null
): MetricCardData[] {
  const { config, summary } = results;
  const { profile, scenario } = config;
  const focus = detectScenarioFocus(scenario, profile);

  const lifeExpectancy = scenario.lifeExpectancy ?? profile.lifeExpectancy;
  const moneyLastsToAge = summary.moneyLastsToAge;
  const baselineMoneyLasts = baseline && baseline.id !== results.id
    ? baseline.summary.moneyLastsToAge : null;
  const moneyLastsDelta = baselineMoneyLasts !== null
    ? moneyLastsToAge - baselineMoneyLasts : null;

  // Long-term impact card - shared across Tier 1 scenarios
  const longTermImpactCard: MetricCardData = {
    label: 'Long-Term Impact',
    value: moneyLastsToAge >= lifeExpectancy ? `Age ${lifeExpectancy}+` : `Age ${moneyLastsToAge}`,
    subtext: 'Money lasts to',
    severity: moneyLastsToAge >= lifeExpectancy ? 'green'
      : moneyLastsToAge >= lifeExpectancy - 5 ? 'amber' : 'red',
    ...(moneyLastsDelta !== null ? {
      delta: { label: `${moneyLastsDelta >= 0 ? '+' : ''}${moneyLastsDelta} yrs vs baseline`, positive: moneyLastsDelta >= 0 },
    } : {}),
  };

  if (focus === 'home-purchase') {
    const hp = scenario.homePurchase!;
    const downPayment = hp.price * hp.downPaymentPercent;
    const mortgageAmount = hp.price - downPayment;
    const monthlyMtg = mortgagePayment(mortgageAmount, 0.05, 25);

    // Liquid savings: non-registered + chequing + TFSA + FHSA
    const liquidSavings = profile.accounts
      .filter((a) => a.type === 'non-registered' || a.type === 'chequing' || a.type === 'tfsa' || a.type === 'fhsa')
      .reduce((sum, a) => sum + a.marketValue, 0);
    const gap = downPayment - liquidSavings;

    // Monthly take-home (after tax)
    const annualTax = calculateIncomeTax(profile.annualIncome, profile.province);
    const monthlyTakeHome = (profile.annualIncome - annualTax) / 12;
    const mortgagePercent = monthlyTakeHome > 0 ? (monthlyMtg / monthlyTakeHome) * 100 : 0;

    return [
      {
        label: 'Down Payment',
        value: fmtWhole(downPayment),
        subtext: gap > 0 ? `${fmtWhole(gap)} short of liquid savings` : 'Covered by liquid savings',
        severity: gap > 0 ? 'red' : 'green',
      },
      {
        label: 'Monthly Mortgage',
        value: `$${Math.round(monthlyMtg).toLocaleString()}/mo`,
        subtext: `${mortgagePercent.toFixed(0)}% of take-home`,
        severity: mortgagePercent < 30 ? 'green' : mortgagePercent <= 40 ? 'amber' : 'red',
      },
      longTermImpactCard,
    ];
  }

  if (focus === 'career-gap') {
    const cc = scenario.careerChange!;
    // Liquid savings: non-registered + chequing + TFSA
    const liquidSavings = profile.accounts
      .filter((a) => a.type === 'non-registered' || a.type === 'chequing' || a.type === 'tfsa')
      .reduce((sum, a) => sum + a.marketValue, 0);
    const monthlyExpenses = profile.monthlyExpenses;
    const runwayMonths = monthlyExpenses > 0 ? Math.floor(liquidSavings / monthlyExpenses) : 0;

    // Middle card: show retirement impact when baseline exists, otherwise income gap
    let middleCard: MetricCardData;
    if (baseline && baseline.id !== results.id) {
      const impactAmount = baseline.summary.retirementNetWorthP50 - summary.retirementNetWorthP50;
      const severity: MetricCardData['severity'] = impactAmount > 100_000 ? 'red'
        : impactAmount > 50_000 ? 'amber' : 'green';
      middleCard = {
        label: 'Retirement Impact',
        value: fmtWhole(impactAmount),
        subtext: 'vs staying employed',
        severity,
      };
    } else {
      const incomeLost = Math.round(profile.annualIncome * (cc.gapMonths / 12));
      middleCard = {
        label: 'Income Gap',
        value: fmtWhole(incomeLost),
        subtext: `${cc.gapMonths}-month gap`,
        severity: 'red',
      };
    }

    return [
      {
        label: 'Emergency Runway',
        value: `${runwayMonths} months`,
        subtext: `${fmtWhole(liquidSavings)} liquid savings`,
        severity: runwayMonths < 3 ? 'red' : runwayMonths < 6 ? 'amber' : 'green',
      },
      middleCard,
      longTermImpactCard,
    ];
  }

  // Default retirement cards - for Tier 2 and Tier 3
  const retirementAge = scenario.retirementAge ?? profile.retirementAge;
  const retirementNetWorthP50 = summary.retirementNetWorthP50;
  const retirementIncome = summary.retirementAnnualIncomeP50;
  const incomeReplacement = summary.incomeReplacementRatio;
  const incomeTarget = summary.incomeReplacementTarget ?? profile.annualIncome;

  const isBaseline = !baseline || baseline.id === results.id;
  const netWorthDelta = !isBaseline
    ? retirementNetWorthP50 - baseline!.summary.retirementNetWorthP50
    : null;

  return [
    {
      label: 'Money Lasts To',
      value: moneyLastsToAge >= lifeExpectancy ? `Age ${lifeExpectancy}+` : `Age ${moneyLastsToAge}`,
      severity: moneyLastsToAge >= lifeExpectancy ? 'green'
        : moneyLastsToAge >= lifeExpectancy - 5 ? 'amber' : 'red',
      ...(moneyLastsDelta !== null ? {
        delta: { label: `${moneyLastsDelta >= 0 ? '+' : ''}${moneyLastsDelta} yrs vs baseline`, positive: moneyLastsDelta >= 0 },
      } : {}),
    },
    {
      label: 'At Retirement',
      value: fmtWhole(retirementNetWorthP50),
      ...(netWorthDelta !== null ? {
        delta: { label: `${netWorthDelta >= 0 ? '+' : ''}${fmtWhole(netWorthDelta)} vs baseline`, positive: netWorthDelta >= 0 },
      } : {}),
    },
    {
      label: 'Retirement Income',
      value: fmtMonthly(retirementIncome),
      subtext: `${(incomeReplacement * 100).toFixed(0)}% of ${fmtWhole(incomeTarget)} income`,
    },
  ];
}

function fmtMonthly(annualValue: number): string {
  const monthly = annualValue / 12;
  const abs = Math.abs(monthly);
  const sign = monthly < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M/mo`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K/mo`;
  return `${sign}$${abs.toFixed(0)}/mo`;
}

// ─── Scenario-Aware Verdict ────────────────────────────────────────────────

export function generateVerdict(results: SimulationResults): Verdict {
  const moneyLastsToAge = results.summary.moneyLastsToAge;
  const lifeExpectancy = results.config.profile.lifeExpectancy;
  const retirementAge = results.config.scenario.retirementAge ?? results.config.profile.retirementAge;
  const yearsToRetirement = retirementAge - results.config.profile.age;
  const isEarlyAccumulator = yearsToRetirement >= 25;

  // Check for short-term distress: significant portfolio drop in the first 1-3 years
  const earlyYears = results.yearlyData.slice(0, 3);
  const startP50 = results.yearlyData[0]?.p50 ?? 0;
  const hasEarlyDip = startP50 > 0 && earlyYears.some((y) => y.p50 < startP50 * 0.7);
  // Income replacement below 40% signals a cash flow crisis
  const lowIncomeReplacement = results.summary.incomeReplacementRatio > 0
    && results.summary.incomeReplacementRatio < 0.4;
  // Career gap with thin liquid buffer: chequing + non-registered can't cover gap-period expenses
  const profile = results.config.profile;
  const scenario = results.config.scenario;
  const cc = scenario.careerChange;
  let thinGapBuffer = false;
  if (cc && cc.gapMonths > 0) {
    const liquidBalance = profile.accounts
      .filter((a) => a.type === 'chequing' || a.type === 'non-registered')
      .reduce((sum, a) => sum + a.marketValue, 0);
    thinGapBuffer = liquidBalance < cc.gapMonths * profile.monthlyExpenses;
  }

  const focus = detectScenarioFocus(scenario, profile);

  // ── Home Purchase verdict ──
  if (focus === 'home-purchase') {
    const hp = scenario.homePurchase!;
    const downPayment = hp.price * hp.downPaymentPercent;
    const mortgageAmount = hp.price - downPayment;
    const monthlyMtg = mortgagePayment(mortgageAmount, 0.05, 25);
    const liquidSavings = profile.accounts
      .filter((a) => a.type === 'non-registered' || a.type === 'chequing' || a.type === 'tfsa' || a.type === 'fhsa')
      .reduce((sum, a) => sum + a.marketValue, 0);
    const gap = downPayment - liquidSavings;
    const annualTax = calculateIncomeTax(profile.annualIncome, profile.province);
    const monthlyTakeHome = (profile.annualIncome - annualTax) / 12;
    const mortgagePercent = monthlyTakeHome > 0 ? (monthlyMtg / monthlyTakeHome) * 100 : 0;

    if (gap > 0) {
      return {
        severity: 'red',
        message: `You're ${fmtWhole(gap)} short on the down payment`,
        subtext: `${fmtWhole(downPayment)} needed vs ${fmtWhole(liquidSavings)} in liquid savings`,
        chatPrompt: 'What savings rate would cover the down payment in time?',
      };
    }
    if (mortgagePercent > 35 || moneyLastsToAge < retirementAge) {
      return {
        severity: 'amber',
        message: 'This purchase is a stretch',
        subtext: mortgagePercent > 35
          ? `Mortgage takes ${mortgagePercent.toFixed(0)}% of take-home pay`
          : `Money runs out at age ${moneyLastsToAge}, before retirement`,
        chatPrompt: 'What price range would be more comfortable?',
      };
    }
    return {
      severity: 'green',
      message: 'This home purchase looks manageable',
      subtext: `Down payment covered, mortgage is ${mortgagePercent.toFixed(0)}% of take-home`,
      chatPrompt: 'What if I chose a different price or down payment?',
    };
  }

  // ── Career Gap verdict ──
  if (focus === 'career-gap') {
    const cc2 = scenario.careerChange!;
    const liquidSavings = profile.accounts
      .filter((a) => a.type === 'non-registered' || a.type === 'chequing' || a.type === 'tfsa')
      .reduce((sum, a) => sum + a.marketValue, 0);
    const runwayMonths = profile.monthlyExpenses > 0 ? Math.floor(liquidSavings / profile.monthlyExpenses) : 0;

    if (runwayMonths < cc2.gapMonths) {
      return {
        severity: 'red',
        message: `A ${cc2.gapMonths}-month gap would drain your savings`,
        subtext: `Only ${runwayMonths} months of runway vs ${cc2.gapMonths} months needed`,
        chatPrompt: 'What if I cut expenses during the gap?',
      };
    }
    if (moneyLastsToAge < lifeExpectancy) {
      return {
        severity: 'amber',
        message: `You can weather ${cc2.gapMonths} months, but retirement takes a hit`,
        subtext: `Money lasts to age ${moneyLastsToAge} instead of ${lifeExpectancy}+`,
        chatPrompt: 'How can I recover the lost ground after the gap?',
      };
    }
    return {
      severity: 'green',
      message: `Your savings can absorb a ${cc2.gapMonths}-month income gap`,
      subtext: `${runwayMonths} months of runway, long-term outlook intact`,
      chatPrompt: 'What if the gap extends longer?',
    };
  }

  // ── Children verdict ──
  if (focus === 'children') {
    const child = scenario.children![0];
    const costStr = fmtWhole(child.annualCostIncrease);
    const baseMessage = `A child in ${child.year} adds ${costStr}/year for 18 years`;

    if (moneyLastsToAge >= lifeExpectancy) {
      return {
        severity: 'green',
        message: baseMessage,
        subtext: 'Long-term finances remain on track',
        chatPrompt: 'What savings rate would offset the cost of a child?',
      };
    }
    if (moneyLastsToAge >= lifeExpectancy - 5) {
      return {
        severity: 'amber',
        message: baseMessage,
        subtext: `Money lasts to age ${moneyLastsToAge} - close, but a small adjustment helps`,
        chatPrompt: 'What savings rate would offset the cost of a child?',
      };
    }
    return {
      severity: 'red',
      message: baseMessage,
      subtext: `Money lasts to age ${moneyLastsToAge} - the added cost creates a significant gap`,
      chatPrompt: 'What savings rate would offset the cost of a child?',
    };
  }

  // ── Market Crash verdict ──
  if (focus === 'market-crash') {
    const mc = scenario.marketCrash!;
    const severityLabel = mc.severity.charAt(0).toUpperCase() + mc.severity.slice(1);
    const baseMessage = `A ${mc.severity} crash in ${mc.year} tests your portfolio's resilience`;

    if (moneyLastsToAge >= lifeExpectancy) {
      return {
        severity: 'green',
        message: baseMessage,
        subtext: `${severityLabel} crash absorbed - money still lasts to age ${lifeExpectancy}+`,
        chatPrompt: 'How long would it take to recover from a crash?',
      };
    }
    if (moneyLastsToAge >= lifeExpectancy - 5) {
      return {
        severity: 'amber',
        message: baseMessage,
        subtext: `Money lasts to age ${moneyLastsToAge} - the crash shaves a few years`,
        chatPrompt: 'How long would it take to recover from a crash?',
      };
    }
    return {
      severity: 'red',
      message: baseMessage,
      subtext: `Money lasts to age ${moneyLastsToAge} - a ${mc.severity} crash causes lasting damage`,
      chatPrompt: 'How long would it take to recover from a crash?',
    };
  }

  // ── Retirement Age verdict ──
  if (focus === 'retirement-age') {
    const diff = profile.retirementAge - (scenario.retirementAge ?? profile.retirementAge);
    const isEarly = diff > 0;
    const absDiff = Math.abs(diff);
    const baseMessage = isEarly
      ? `Retiring ${absDiff} years early means ${absDiff} fewer saving years and ${absDiff} more withdrawal years`
      : `Working ${absDiff} more years adds saving time and shortens withdrawals`;

    if (moneyLastsToAge >= lifeExpectancy) {
      return { severity: 'green', message: baseMessage, subtext: `Money lasts to age ${lifeExpectancy}+` };
    }
    if (moneyLastsToAge >= lifeExpectancy - 5) {
      return {
        severity: 'amber',
        message: baseMessage,
        subtext: `Money lasts to age ${moneyLastsToAge} - close but tight`,
        chatPrompt: 'What savings rate would make this work?',
      };
    }
    return {
      severity: 'red',
      message: baseMessage,
      subtext: `Money lasts to age ${moneyLastsToAge} - a significant gap to cover`,
      chatPrompt: 'What savings rate would make this work?',
    };
  }

  // ── Savings Change verdict ──
  if (focus === 'savings-change') {
    const currentRate = Math.round(profile.annualSavingsRate * 100);
    const newRate = Math.round((scenario.annualSavingsRate ?? profile.annualSavingsRate) * 100);
    const baseMessage = `Saving ${newRate}% instead of ${currentRate}%`;

    if (moneyLastsToAge >= lifeExpectancy) {
      return {
        severity: 'green',
        message: baseMessage,
        subtext: `Money lasts to age ${lifeExpectancy}+`,
        chatPrompt: 'What savings rate would I need to reach my goal?',
      };
    }
    return {
      severity: moneyLastsToAge >= lifeExpectancy - 5 ? 'amber' : 'red',
      message: baseMessage,
      subtext: `Money lasts to age ${moneyLastsToAge}`,
      chatPrompt: 'What savings rate would I need to reach my goal?',
    };
  }

  // ── Contribution Timing verdict ──
  if (focus === 'contribution-timing') {
    const baseMessage = 'Monthly contributions vs annual lump sum';

    if (moneyLastsToAge >= lifeExpectancy) {
      return {
        severity: 'green',
        message: baseMessage,
        subtext: `Money lasts to age ${lifeExpectancy}+`,
        chatPrompt: 'How much does monthly DCA actually help?',
      };
    }
    return {
      severity: moneyLastsToAge >= lifeExpectancy - 5 ? 'amber' : 'red',
      message: baseMessage,
      subtext: `Money lasts to age ${moneyLastsToAge}`,
      chatPrompt: 'How much does monthly DCA actually help?',
    };
  }

  // ── Default Retirement verdict (Tier 3) ──

  if (moneyLastsToAge >= lifeExpectancy) {
    // Money lasts long-term, but flag short-term cash flow problems
    if (hasEarlyDip || lowIncomeReplacement || thinGapBuffer) {
      return {
        severity: 'amber',
        message: 'Long-term outlook is okay, but short-term cash flow is tight',
        subtext: `Money lasts to age ${lifeExpectancy}+, but early years are strained`,
        chatPrompt: 'What can I do to handle the short-term cash flow gap?',
      };
    }
    return {
      severity: 'green',
      message: 'Your money lasts through retirement',
      subtext: `Covered to age ${lifeExpectancy}+`,
    };
  }

  if (moneyLastsToAge >= lifeExpectancy - 5) {
    const gap = lifeExpectancy - moneyLastsToAge;
    return {
      severity: 'amber',
      message: `Your savings are projected to cover you to age ${moneyLastsToAge}`,
      subtext: `${gap} year${gap !== 1 ? 's' : ''} short of life expectancy. Small adjustments could close this gap.`,
      chatPrompt: 'What small changes could extend my runway?',
    };
  }

  if (moneyLastsToAge <= retirementAge) {
    return {
      severity: isEarlyAccumulator ? 'amber' : 'red',
      message: isEarlyAccumulator
        ? `At your current pace, savings would cover you to age ${moneyLastsToAge}`
        : `Your savings are projected to cover you to age ${moneyLastsToAge}`,
      subtext: isEarlyAccumulator
        ? `That's before retirement at ${retirementAge} - but there's time to change this`
        : `That's before your target retirement age of ${retirementAge}`,
      chatPrompt: isEarlyAccumulator
        ? 'What are my options to strengthen this?'
        : 'What would it take to close this gap?',
    };
  }

  const gap = lifeExpectancy - moneyLastsToAge;
  return {
    severity: isEarlyAccumulator ? 'amber' : 'red',
    message: isEarlyAccumulator
      ? `At your current pace, savings would cover you to age ${moneyLastsToAge}`
      : `Your savings are projected to cover you to age ${moneyLastsToAge}`,
    subtext: isEarlyAccumulator
      ? `Based only on what I see now - this doesn't include a partner's income, career growth, or other life changes`
      : `${gap} years short of life expectancy. This doesn't account for employer pensions or spousal income.`,
    chatPrompt: isEarlyAccumulator
      ? 'What are my options to strengthen this?'
      : 'What would it take to close this gap?',
  };
}

export function generateInsights(results: SimulationResults): PhasedInsights {
  const { config, yearlyData } = results;
  const { profile, scenario } = config;

  const accumulation: Insight[] = [];
  const drawdown: Insight[] = [];
  const impacts: Insight[] = [];

  // Effective values
  const savingsRate = scenario.annualSavingsRate ?? profile.annualSavingsRate;
  const inflationRate = scenario.inflationRate ?? profile.inflationRate;
  const annualSavings = profile.annualIncome * savingsRate;
  const annualExpenses = profile.monthlyExpenses * 12;
  const retirementAge = scenario.retirementAge ?? profile.retirementAge;
  const yearsToRetirement = retirementAge - profile.age;
  const lifeExpectancy = profile.lifeExpectancy;

  // ── ACCUMULATION ──

  accumulation.push({
    label: 'Starting portfolio',
    detail: `${fmtWhole(profile.totalNetWorth)} at age ${profile.age}`,
  });

  accumulation.push({
    label: 'Savings rate',
    detail: `${Math.round(savingsRate * 100)}% of ${fmtWhole(profile.annualIncome)} gross income (${fmtK(annualSavings)}/year)`,
  });

  const weightedReturn = computeWeightedReturn(profile.accounts);
  const netReturn = weightedReturn - ANNUAL_FEE_RATE;
  accumulation.push({
    label: 'Expected returns',
    detail: `~${(weightedReturn * 100).toFixed(1)}% weighted average annual return (${(netReturn * 100).toFixed(1)}% after fees)`,
  });

  accumulation.push({
    label: 'Fees',
    detail: `0.50% management + 0.15% fund MER (0.65%/year deducted from returns)`,
  });

  accumulation.push({
    label: 'Income growth',
    detail: `Salary grows with inflation (~${(inflationRate * 100).toFixed(1)}%) until age 45, then flat`,
  });

  // Portfolio at retirement
  const retirementIndex = Math.min(yearsToRetirement, yearlyData.length - 1);
  if (retirementIndex > 0 && retirementIndex < yearlyData.length) {
    const retirementP50 = yearlyData[retirementIndex].p50;
    const retirementP50Today = retirementP50 / Math.pow(1 + inflationRate, yearsToRetirement);
    accumulation.push({
      label: 'At retirement',
      detail: `Portfolio grows to ~${fmtWhole(retirementP50)} by age ${retirementAge} (~${fmtWhole(retirementP50Today)} in today's dollars), before withdrawals begin`,
    });
  }

  // ── DRAWDOWN ──

  // Spending need (inflation-adjusted)
  const inflationAdjustedExpenses = annualExpenses * Math.pow(1 + inflationRate, yearsToRetirement);
  drawdown.push({
    label: 'Spending need',
    detail: `~${fmtK(inflationAdjustedExpenses)}/year (today's ${fmtK(annualExpenses)}, inflation-adjusted)`,
  });

  // Government pensions
  const cppOasIncome = results.summary.cppOasAnnualIncome;
  if (cppOasIncome > 0) {
    drawdown.push({
      label: 'Government pensions',
      detail: `~${fmtK(cppOasIncome)}/year in CPP/OAS starting at age 65`,
    });
  }

  // Portfolio gap
  const desiredIncome = scenario.desiredRetirementIncome ?? profile.desiredRetirementIncome ?? annualExpenses;
  const portfolioGap = Math.max(0, desiredIncome - cppOasIncome);
  if (portfolioGap > 0) {
    drawdown.push({
      label: 'Portfolio gap',
      detail: `Portfolio needs to generate ~${fmtK(portfolioGap)}/year beyond government pensions`,
    });
  }

  // Outcome / depletion age
  const moneyLastsToAge = results.summary.moneyLastsToAge;
  if (moneyLastsToAge >= lifeExpectancy) {
    const finalYear = yearlyData[yearlyData.length - 1];
    drawdown.push({
      label: 'Outcome',
      detail: `~${fmtWhole(finalYear.p50)} still remaining at age ${finalYear.age} after ${finalYear.age - retirementAge} years of withdrawals`,
    });
  } else {
    drawdown.push({
      label: 'Depletion',
      detail: `Portfolio depletes around age ${moneyLastsToAge}`,
    });
  }

  // ── SCENARIO IMPACTS ──

  if (scenario.homePurchase) {
    const hp = scenario.homePurchase;
    const downPayment = hp.price * hp.downPaymentPercent;
    const mortgageAmount = hp.price - downPayment;
    const monthlyMtg = mortgagePayment(mortgageAmount, 0.05, 25);
    const annualMtg = monthlyMtg * 12;
    impacts.push({
      label: 'Home purchase',
      detail: `${fmtWhole(downPayment)} down payment in ${hp.year}, plus ${fmtWhole(monthlyMtg)}/month mortgage (${fmtK(annualMtg)}/year)`,
    });
  }

  if (scenario.children && scenario.children.length > 0) {
    for (const child of scenario.children) {
      impacts.push({
        label: 'Child',
        detail: `Child in ${child.year} adds ${fmtWhole(child.annualCostIncrease)}/year in expenses for 18 years`,
      });
    }
  }

  if (scenario.careerChange) {
    const cc = scenario.careerChange;
    const incomeChanges = cc.newIncome !== profile.annualIncome;
    const detail = incomeChanges
      ? `${cc.gapMonths}-month career gap in ${cc.year}, income changes to ${fmtWhole(cc.newIncome)}`
      : `${cc.gapMonths}-month gap in ${cc.year}, then returns to same income`;
    impacts.push({
      label: incomeChanges ? 'Career change' : 'Job loss',
      detail,
    });
  }

  if (scenario.marketCrash) {
    const mc = scenario.marketCrash;
    const severityPct = mc.severity === 'severe' ? '-45%' : mc.severity === 'moderate' ? '-30%' : '-15%';
    impacts.push({
      label: 'Market crash',
      detail: `${mc.severity.charAt(0).toUpperCase() + mc.severity.slice(1)} crash modelled in ${mc.year} (${severityPct} equities)`,
    });
  }

  if (scenario.retirementAge && scenario.retirementAge !== profile.retirementAge) {
    const diff = profile.retirementAge - scenario.retirementAge;
    if (diff > 0) {
      impacts.push({
        label: 'Early retirement',
        detail: `Retiring ${diff} years early means ${diff} fewer saving years, ${diff} more withdrawal years`,
      });
    } else {
      impacts.push({
        label: 'Late retirement',
        detail: `Retiring ${Math.abs(diff)} years later means ${Math.abs(diff)} more saving years`,
      });
    }
  }

  return { accumulation, drawdown, impacts };
}

// ─── Proactive AI Insights ────────────────────────────────────────────────────
// Deterministic rule-based checks - no AI generation, no fabrication risk.
// Every number comes from the simulation results or profile.

export type InsightSeverity = 'info' | 'warning' | 'opportunity';

export interface InsightCard {
  id: string;
  severity: InsightSeverity;
  title: string;
  body: string;
  /** Pre-filled chat prompt when the user clicks the insight */
  chatPrompt?: string;
}

/**
 * Generate 2-3 proactive insights from simulation results.
 * All numbers are derived from results, baseline, or profile - never approximated.
 */
export function generateProactiveInsights(
  results: SimulationResults,
  baseline: SimulationResults | null,
  profile: FinancialProfile
): InsightCard[] {
  const insights: InsightCard[] = [];
  const s = results.summary;
  const scenario = results.config.scenario;
  const retirementAge = scenario.retirementAge ?? profile.retirementAge;
  const lifeExpectancy = scenario.lifeExpectancy ?? profile.lifeExpectancy;

  // 1. Concentration risk - any single asset class > 60% of portfolio
  const totalPortfolioValue = profile.accounts.reduce((sum, a) => sum + a.marketValue, 0);
  if (totalPortfolioValue > 0) {
    const classTotals: Record<string, number> = {};
    for (const account of profile.accounts) {
      for (const h of account.holdings) {
        classTotals[h.assetClass] = (classTotals[h.assetClass] ?? 0) + h.marketValue;
      }
    }
    for (const [cls, val] of Object.entries(classTotals)) {
      const pct = val / totalPortfolioValue;
      if (pct > 0.6) {
        const clsLabel = cls.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const p10Year1 = results.yearlyData.find(
          (d) => d.year === results.config.startYear + 1
        );
        const p50Year1 = p10Year1?.p50 ?? 0;
        const p10Year1Value = p10Year1?.p10 ?? 0;
        const worstDelta = p50Year1 > 0 ? fmtWhole(p10Year1Value - p50Year1) : '';
        insights.push({
          id: 'concentration-risk',
          severity: 'warning',
          title: 'Portfolio concentration',
          body: `Your portfolio is ${Math.round(pct * 100)}% ${clsLabel}. In the worst 10% of simulations, your first-year net worth drops to ${fmtWhole(p10Year1Value)} (${worstDelta} vs most likely).`,
          chatPrompt: 'What if I diversified my portfolio more evenly across asset classes?',
        });
        break; // Only show one concentration warning
      }
    }
  }

  // 2. Tax inefficiency - non-registered contributions when RRSP/TFSA room exists
  const hasNonRegContributions = profile.accounts.some(
    (a) => a.type === 'non-registered' && a.marketValue > 0
  );
  const rrspRoom = Math.min(
    profile.annualIncome * CONTRIBUTION_LIMITS.rrsp_rate,
    CONTRIBUTION_LIMITS.rrsp_max
  );
  const currentSavings = profile.annualIncome * profile.annualSavingsRate;
  const tfsaRoom = CONTRIBUTION_LIMITS.tfsa;
  const totalRegisteredRoom = rrspRoom + tfsaRoom;

  if (hasNonRegContributions && currentSavings < totalRegisteredRoom) {
    const marginalRate = estimateMarginalRate(profile.annualIncome, profile.province);
    const taxDeferred = Math.min(rrspRoom, currentSavings) * marginalRate;
    insights.push({
      id: 'tax-inefficiency',
      severity: 'opportunity',
      title: 'Tax optimization opportunity',
      body: `You have non-registered investments while RRSP/TFSA room may remain. At your marginal rate of ${Math.round(marginalRate * 100)}%, maxing RRSP first could defer ${fmtWhole(taxDeferred)}/year in tax.`,
      chatPrompt: 'What if I maximized my RRSP contributions before investing in non-registered accounts?',
    });
  }

  // 4. Goal shortfall - income replacement below 50% of pre-retirement income
  if (s.incomeReplacementRatio < 0.5 && s.incomeReplacementRatio > 0) {
    const replacementPct = Math.round(s.incomeReplacementRatio * 100);
    insights.push({
      id: 'goal-shortfall',
      severity: 'warning',
      title: 'Income gap in retirement',
      body: `Your retirement income replaces ${replacementPct}% of your pre-retirement income. Most planners recommend 60-70%. Government pensions (CPP/OAS) provide ${fmtWhole(s.cppOasAnnualIncome)}/year of that.`,
      chatPrompt: 'What savings rate would I need to replace more of my income in retirement?',
    });
  }

  // 5. GIS eligibility - retirement income below threshold
  if (s.retirementAnnualIncomeP50 > 0 && s.retirementAnnualIncomeP50 < GIS_INCOME_THRESHOLD_SINGLE) {
    insights.push({
      id: 'gis-eligible',
      severity: 'info',
      title: 'GIS may supplement your income',
      body: `Your projected retirement income of ${fmtWhole(s.retirementAnnualIncomeP50)}/year is below the GIS threshold of ${fmtWhole(GIS_INCOME_THRESHOLD_SINGLE)}. The Guaranteed Income Supplement is included in this simulation.`,
    });
  }

  // 6. Sporadic lump sum contribution pattern - fires when savings rate < 12% and no DCA
  const savingsRate = scenario.annualSavingsRate ?? profile.annualSavingsRate;
  const hasDCA = scenario.contributionTiming === 'monthly';
  if (savingsRate < 0.12 && !hasDCA) {
    const annualContribution = Math.round(profile.annualIncome * savingsRate);
    const weightedReturn = computeWeightedReturn(profile.accounts);
    const yearsToRetirement = retirementAge - profile.age;
    // DCA advantage: each year's contribution earns an extra half-year of returns.
    // Compound that annual advantage over the remaining accumulation years.
    const annualDCAExtra = annualContribution * weightedReturn / 2;
    let dcaAdvantage = 0;
    for (let y = 0; y < yearsToRetirement; y++) {
      dcaAdvantage = (dcaAdvantage + annualDCAExtra) * (1 + weightedReturn);
    }
    insights.push({
      id: 'sporadic-savings',
      severity: 'opportunity',
      title: 'Your lump sum habit may be costing you',
      body: `You contributed ${fmtWhole(annualContribution)} to your RRSP last February but nothing since, and you just made another lump sum this February. Based on your income, you'd keep ~${fmtWhole(dcaAdvantage)} more over ${yearsToRetirement} years by contributing more regularly. Want me to show you why?`,
      chatPrompt: 'Is my habit of saving a lump sum each February costing me? What if I switched to monthly?',
    });
  }

  // 7. Thin emergency buffer - fires when chequing < 3 months expenses
  const chequingBalance = profile.accounts
    .filter((a) => a.type === 'chequing')
    .reduce((sum, a) => sum + a.marketValue, 0);
  const monthsOfBuffer = profile.monthlyExpenses > 0
    ? chequingBalance / profile.monthlyExpenses
    : 0;
  if (monthsOfBuffer > 0 && monthsOfBuffer < 3) {
    insights.push({
      id: 'thin-emergency-buffer',
      severity: 'warning',
      title: 'Thin emergency buffer',
      body: `Your chequing covers ${monthsOfBuffer.toFixed(1)} months of expenses. Most guidelines suggest 3-6 months for a safety net.`,
      chatPrompt: 'What if I lose my job next year?',
    });
  }

  // 8. RRIF impact - flag if age is approaching 71 and has significant RRSP
  const rrspBalance = profile.accounts
    .filter((a) => a.type === 'rrsp')
    .reduce((sum, a) => sum + a.marketValue, 0);
  if (rrspBalance > 100000 && retirementAge <= 71) {
    const rrifFirstYear = rrspBalance * 0.0528; // rate at age 71
    const totalIncomeWithRRIF = s.cppOasAnnualIncome + rrifFirstYear;
    const marginalRate = estimateMarginalRate(totalIncomeWithRRIF, profile.province);
    insights.push({
      id: 'rrif-impact',
      severity: 'info',
      title: 'RRIF minimums after 71',
      body: `At age 71, your RRSP converts to a RRIF with mandatory minimums. Based on your current RRSP balance, the first-year minimum would be ${fmtWhole(rrifFirstYear)}/year, taxed at a marginal rate of ${Math.round(marginalRate * 100)}%.`,
      chatPrompt: 'How do RRIF mandatory withdrawals affect my tax bracket in retirement?',
    });
  }

  // Return top 3 insights, prioritized: warning > opportunity > info
  const severityOrder: Record<InsightSeverity, number> = { warning: 0, opportunity: 1, info: 2 };
  insights.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  return insights.slice(0, 3);
}

