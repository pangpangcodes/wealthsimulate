import type {
  SimulationConfig,
  SimulationResults,
  YearlyPercentiles,
  SimulationSummary,
  GoalOutcome,
  ScenarioOverrides,
} from '@/lib/types';
import type { Account, AccountType, FinancialProfile, AssetClass } from '@/lib/types';
import { isInvestmentAccount } from '@/lib/types';
import {
  generateCorrelatedReturns,
  applyCrashToReturns,
  createSeededRandom,
  ASSET_CLASS_PARAMS,
} from './distributions';
import {
  calculateIncomeTax,
  calculateInvestmentTax,
  calculateRRSPRoom,
  calculateRRSPWithdrawalTax,
  estimateMarginalRate,
  CONTRIBUTION_LIMITS,
} from './canadian-tax';
import { LIFE_EVENT_PROBABILITIES } from './scenarios';
import { calculateGovernmentPensions, calculateGovernmentPensionsAtAge65 } from './government-pensions';

// ─── RRIF Mandatory Minimum Withdrawal Rates ────────────────────────────────
// Source: CRA prescribed factors
// https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/completing-slips-summaries/t4rsp-t4rif-information-returns/payments/chart-prescribed-factors.html
// For ages 70 and younger: 1 / (90 - age)
// After age 71, RRSPs must convert to RRIFs with forced minimum withdrawals.

const RRIF_MINIMUM_RATES: Record<number, number> = {
  71: 0.0528, 72: 0.0540, 73: 0.0553, 74: 0.0567, 75: 0.0582,
  76: 0.0598, 77: 0.0617, 78: 0.0636, 79: 0.0658, 80: 0.0682,
  81: 0.0708, 82: 0.0738, 83: 0.0771, 84: 0.0808, 85: 0.0851,
  86: 0.0899, 87: 0.0955, 88: 0.1021, 89: 0.1099, 90: 0.1192,
};

// Annual investment fees: 0.50% management + 0.15% fund MER
export const ANNUAL_FEE_RATE = 0.0065;

/** Get the RRIF minimum withdrawal rate for a given age */
function getRRIFMinimumRate(age: number): number {
  if (age < 71) return 0; // No mandatory minimum before 71
  if (age <= 90) return RRIF_MINIMUM_RATES[age];
  return 0.1192; // Ages 90+ use the same rate as 90
}

// ─── Year-level result for richer summary computation ───────────────────────

export interface YearResult {
  netWorth: number;
  govPensionIncome: number;     // 0 pre-retirement
  portfolioWithdrawal: number;  // 0 pre-retirement
  rrspTaxPaid: number;          // 0 pre-retirement
  govIncomeTaxPaid: number;     // income tax on CPP/OAS/GIS (0 pre-retirement)
}

interface WithdrawalResult {
  accounts: Account[];
  byType: Partial<Record<AccountType, number>>;
}

// ─── Main Simulation Entry Point ────────────────────────────────────────────

export function runSimulation(
  config: SimulationConfig,
  onProgress?: (progress: number) => void
): SimulationResults {
  const { numPaths, yearsToProject, startYear, profile, scenario } = config;

  // Fixed base seed so all scenarios share the same random draws per path.
  // This means path #42 in "Current Path" and path #42 in "Job Loss" see
  // identical market returns and life events - only the scenario differs.
  const BASE_SEED = 42;

  // All paths: array of arrays, each inner array is YearResult per year
  const allPaths: YearResult[][] = [];
  let validPaths = 0;

  for (let path = 0; path < numPaths; path++) {
    try {
      const rand = createSeededRandom(BASE_SEED + path);
      const pathResult = simulateSinglePath(profile, scenario, yearsToProject, startYear, rand);
      if (pathResult.every((v) => isFinite(v.netWorth) && !isNaN(v.netWorth))) {
        allPaths.push(pathResult);
        validPaths++;
      }
    } catch {
      // Skip corrupted paths
    }

    // Report progress every 100 paths
    if (onProgress && path % 100 === 0) {
      onProgress(path / numPaths);
    }
  }

  if (validPaths === 0) {
    throw new Error('All simulation paths failed');
  }

  // Calculate percentiles per year (uses netWorth from YearResult)
  const yearlyData = calculatePercentiles(allPaths, startYear, profile.age);

  // Calculate summary
  const summary = calculateSummary(allPaths, profile, scenario, startYear);

  return {
    id: `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    scenarioName: scenario.name,
    timestamp: Date.now(),
    config,
    yearlyData,
    summary,
    validPaths,
    totalPaths: numPaths,
  };
}

// ─── Single Path Simulation ─────────────────────────────────────────────────

function simulateSinglePath(
  profile: FinancialProfile,
  scenario: ScenarioOverrides,
  years: number,
  startYear: number,
  rand: () => number = Math.random
): YearResult[] {
  const resultsByYear: YearResult[] = [];
  const retirementAge = scenario.retirementAge ?? profile.retirementAge;
  const savingsRate = scenario.annualSavingsRate ?? profile.annualSavingsRate;
  const inflationRate = scenario.inflationRate ?? profile.inflationRate;

  // Clone only investment accounts for this path (skip chequing/credit-card)
  let accounts = profile.accounts
    .filter(isInvestmentAccount)
    .map((a) => ({
      ...a,
      marketValue: a.marketValue,
      holdings: a.holdings.map((h) => ({ ...h })),
    }));

  let currentIncome = profile.annualIncome;
  const baseAnnualExpenses = profile.monthlyExpenses * 12;
  let fixedNominalExpenses = 0; // mortgage payments (don't inflate)
  let isEmployed = true;
  let unemploymentMonths = 0;

  for (let year = 0; year < years; year++) {
    const calendarYear = startYear + year;
    const age = profile.age + year;
    const isRetired = age >= retirementAge;
    const inflationFactor = Math.pow(1 + inflationRate, year);

    // Per-year tracking for YearResult
    let yearGovPensionIncome = 0;
    let yearPortfolioWithdrawal = 0;
    let yearRrspTaxPaid = 0;
    let yearGovIncomeTaxPaid = 0;

    // ── Apply scenario overrides ──

    // Career change
    if (scenario.careerChange && calendarYear === scenario.careerChange.year) {
      isEmployed = false;
      unemploymentMonths = scenario.careerChange.gapMonths;
      // Income changes AFTER the gap
      currentIncome = scenario.careerChange.newIncome;
    }

    // Pure job loss (no career change, just gap) - if careerChange has same income
    // the impact comes from the gap itself

    // Children expenses (computed fresh each year, no accumulation)
    let childrenExpenses = 0;
    if (scenario.children) {
      for (const child of scenario.children) {
        if (calendarYear >= child.year) {
          const yearsWithChild = calendarYear - child.year;
          if (yearsWithChild < 18) {
            childrenExpenses += child.annualCostIncrease;
          }
        }
      }
    }

    // Home purchase
    if (scenario.homePurchase && calendarYear === scenario.homePurchase.year) {
      const downPayment = scenario.homePurchase.price * scenario.homePurchase.downPaymentPercent;
      // Deduct down payment from non-registered accounts first, then others
      accounts = deductFromAccounts(accounts, downPayment);

      // Add mortgage payment as ongoing expense (~5% rate, 25yr amortization)
      const mortgageAmount = scenario.homePurchase.price - downPayment;
      const monthlyMortgage = calculateMortgagePayment(mortgageAmount, 0.05, 25);
      fixedNominalExpenses += monthlyMortgage * 12;
    }

    // ── Generate market returns ──

    let returns = generateCorrelatedReturns(rand);

    // Apply market crash if applicable
    if (scenario.marketCrash && calendarYear === scenario.marketCrash.year) {
      returns = applyCrashToReturns(returns, scenario.marketCrash.severity, rand);
    }

    // ── Apply returns to each account ──

    for (const account of accounts) {
      let totalReturn = 0;

      // Weighted return based on holdings
      if (account.holdings.length > 0) {
        for (const holding of account.holdings) {
          const assetReturn = returns[holding.assetClass] ?? 0;
          totalReturn += holding.allocation * assetReturn;
        }
      } else {
        // Default to balanced return
        totalReturn = returns['canadian-equity'] * 0.4 +
          returns['us-equity'] * 0.3 +
          returns['canadian-bonds'] * 0.3;
      }

      const gains = account.marketValue * totalReturn;

      // Tax on gains (only matters for non-registered)
      const tax = calculateInvestmentTax(
        Math.max(0, gains),
        account.type,
        profile.province,
        estimateMarginalRate(currentIncome, profile.province)
      );

      account.marketValue = Math.max(0, account.marketValue + gains - tax);

      // Deduct annual investment fees (management + fund MER)
      account.marketValue *= (1 - ANNUAL_FEE_RATE);
    }

    // ── Life events (random) ──
    // Always consume the random draw to keep sequences aligned across scenarios

    const jobLossRoll = rand();
    if (!isRetired && isEmployed) {
      if (jobLossRoll < LIFE_EVENT_PROBABILITIES.jobLoss) {
        isEmployed = false;
        unemploymentMonths = LIFE_EVENT_PROBABILITIES.jobLossRecoveryMonths;
      }
    }

    // Unemployment recovery - track fraction of year unemployed BEFORE recovering
    let unemployedFractionThisYear = 0;
    if (!isEmployed && unemploymentMonths > 0) {
      const monthsThisYear = Math.min(unemploymentMonths, 12);
      unemployedFractionThisYear = monthsThisYear / 12;
      unemploymentMonths -= 12;
      if (unemploymentMonths <= 0) {
        isEmployed = true;
        unemploymentMonths = 0;
      }
    }

    // Medical emergency
    if (rand() < LIFE_EVENT_PROBABILITIES.medicalEmergency) {
      accounts = deductFromAccounts(accounts, LIFE_EVENT_PROBABILITIES.medicalCost);
    }

    // Windfall
    if (rand() < LIFE_EVENT_PROBABILITIES.windfall) {
      // Add to TFSA first, then non-reg
      const tfsa = accounts.find((a) => a.type === 'tfsa');
      const nonReg = accounts.find((a) => a.type === 'non-registered');
      const amount = LIFE_EVENT_PROBABILITIES.windfallAmount;

      if (tfsa) {
        const tfsaRoom = CONTRIBUTION_LIMITS.tfsa;
        tfsa.marketValue += Math.min(amount, tfsaRoom);
        if (nonReg && amount > tfsaRoom) {
          nonReg.marketValue += amount - tfsaRoom;
        }
      } else if (nonReg) {
        nonReg.marketValue += amount;
      }
    }

    // ── Contributions / Withdrawals ──

    if (!isRetired) {
      const inflatedExpenses =
        (baseAnnualExpenses + childrenExpenses) * inflationFactor
        + fixedNominalExpenses;

      if (unemployedFractionThisYear > 0) {
        // Partially or fully unemployed this year:
        // - No income during unemployed months, full income during employed months
        // - EI/severance supplements income during the gap
        // - No savings during unemployment - all income goes to expenses
        const employedFraction = 1 - unemployedFractionThisYear;
        const earnedIncome = currentIncome * employedFraction;
        const gapIncome = scenario.additionalIncome ?? 0;
        const totalIncome = earnedIncome + gapIncome;
        const incomeTax = calculateIncomeTax(totalIncome, profile.province);

        // Still need to pay expenses all year, but only earn part of the year + EI
        const deficit = inflatedExpenses - (totalIncome - incomeTax);
        if (deficit > 0) {
          accounts = deductFromAccounts(accounts, deficit);
        }
      } else if (isEmployed) {
        // Fully employed - normal contributions
        const annualSavings = currentIncome * savingsRate;

        if (scenario.extraContributions) {
          const ec = scenario.extraContributions;
          if (calendarYear >= ec.startYear && calendarYear <= ec.endYear) {
            const targetAccount = accounts.find((a) => a.type === ec.accountType);
            if (targetAccount) {
              targetAccount.marketValue += ec.annualAmount;
            }
          }
        }

        // DCA approximation: monthly contributions earn returns for half the year
        // on average vs lump sum at start of year. Apply half-year return boost.
        if (scenario.contributionTiming === 'monthly') {
          const weightedReturn = computeWeightedReturnForAccounts(accounts, returns);
          const halfYearReturn = weightedReturn / 2;
          distributeContributions(accounts, annualSavings * (1 + halfYearReturn), currentIncome);
        } else {
          distributeContributions(accounts, annualSavings, currentIncome);
        }

        // Income tax with RRSP deduction: RRSP contributions reduce taxable income
        const rrspContribution = Math.min(annualSavings, calculateRRSPRoom(currentIncome));
        const taxableIncome = currentIncome - rrspContribution;
        const incomeTax = calculateIncomeTax(taxableIncome, profile.province);
        const afterTaxIncome = currentIncome - incomeTax - annualSavings;
        const deficit = inflatedExpenses - afterTaxIncome;
        if (deficit > 0) {
          accounts = deductFromAccounts(accounts, deficit);
        }
      } else {
        // Fully unemployed for the whole year - drain savings for expenses
        accounts = deductFromAccounts(accounts, inflatedExpenses);
      }
    } else {
      // ── Retired - withdraw for expenses, offset by government pensions ──
      const inflatedExpenses =
        (baseAnnualExpenses + childrenExpenses) * inflationFactor
        + fixedNominalExpenses;

      // Calculate government pension income (CPP/OAS/GIS)
      // First pass: estimate portfolio withdrawal as full expenses (for OAS clawback)
      const govIncome = calculateGovernmentPensions(
        age,
        inflationFactor,
        Math.max(0, inflatedExpenses), // rough estimate for OAS clawback
        { cppBenefitRate: profile.cppBenefitRate ?? 0.65 }
      );
      yearGovPensionIncome = govIncome.total;

      // Tax on government pension income (CPP/OAS/GIS are taxable)
      // Compute in today's dollars then inflate back to nominal
      const govIncomeToday = govIncome.total / inflationFactor;
      const govIncomeTax = calculateIncomeTax(govIncomeToday, profile.province) * inflationFactor;
      yearGovIncomeTaxPaid = govIncomeTax;

      // Portfolio must cover both living expenses AND tax on government income
      const portfolioNeeded = Math.max(0, inflatedExpenses + govIncomeTax - govIncome.total);

      // ── RRIF mandatory minimum withdrawal (age 71+) ──
      // After age 71, RRSPs convert to RRIFs with forced minimum withdrawals.
      const rrifRate = getRRIFMinimumRate(age);
      const rrspBalance = accounts
        .filter((a) => a.type === 'rrsp')
        .reduce((sum, a) => sum + a.marketValue, 0);
      const rrifMinimum = rrifRate > 0 ? rrspBalance * rrifRate : 0;

      if (portfolioNeeded > 0 || rrifMinimum > 0) {
        // Use tracked withdrawal to know RRSP portion
        const withdrawal = deductFromAccountsTracked(accounts, Math.max(portfolioNeeded, 0));
        accounts = withdrawal.accounts;
        const actualWithdrawn = Object.values(withdrawal.byType).reduce((sum, v) => sum + (v ?? 0), 0);
        yearPortfolioWithdrawal = actualWithdrawn;

        // Calculate how much was already withdrawn from RRSP vs the RRIF minimum
        let rrspWithdrawn = withdrawal.byType.rrsp ?? 0;

        // If RRIF minimum exceeds what was already withdrawn from RRSP, force the extra
        if (rrifMinimum > rrspWithdrawn) {
          const extraRrifNeeded = rrifMinimum - rrspWithdrawn;
          const rrspAccount = accounts.find((a) => a.type === 'rrsp');
          if (rrspAccount && rrspAccount.marketValue > 0) {
            const extraWithdrawn = Math.min(extraRrifNeeded, rrspAccount.marketValue);
            rrspAccount.marketValue -= extraWithdrawn;
            rrspWithdrawn += extraWithdrawn;
            yearPortfolioWithdrawal += extraWithdrawn;
            // Excess RRIF withdrawal beyond expenses goes to non-registered account
            const nonReg = accounts.find((a) => a.type === 'non-registered');
            if (nonReg) {
              nonReg.marketValue += extraWithdrawn;
            }
          }
        }

        // Tax on total RRSP/RRIF withdrawals (all RRSP withdrawals are taxable income)
        if (rrspWithdrawn > 0) {
          const rrspTax = calculateRRSPWithdrawalTax(
            rrspWithdrawn,
            govIncome.total,
            profile.province
          );
          yearRrspTaxPaid = rrspTax;
          // Withdraw the tax amount from accounts too
          if (rrspTax > 0) {
            accounts = deductFromAccounts(accounts, rrspTax);
            yearPortfolioWithdrawal += rrspTax;
          }
        }
      }
    }

    // Inflation-adjust income
    if (year > 0 && isEmployed && age < 45) {
      currentIncome *= 1 + inflationRate;
    }

    // Record year result
    const totalNetWorth = accounts.reduce((sum, a) => sum + Math.max(0, a.marketValue), 0);
    resultsByYear.push({
      netWorth: totalNetWorth,
      govPensionIncome: yearGovPensionIncome,
      portfolioWithdrawal: yearPortfolioWithdrawal,
      rrspTaxPaid: yearRrspTaxPaid,
      govIncomeTaxPaid: yearGovIncomeTaxPaid,
    });
  }

  return resultsByYear;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

function deductFromAccounts(accounts: Account[], amount: number): Account[] {
  let remaining = amount;

  // Priority: non-registered -> TFSA -> RRSP
  const order: Account['type'][] = ['non-registered', 'tfsa', 'fhsa', 'rrsp', 'resp'];

  for (const type of order) {
    if (remaining <= 0) break;
    for (const account of accounts) {
      if (remaining <= 0) break;
      if (account.type === type && account.marketValue > 0) {
        const deduction = Math.min(account.marketValue, remaining);
        account.marketValue -= deduction;
        remaining -= deduction;
      }
    }
  }

  return accounts;
}

/** Same as deductFromAccounts but tracks how much was withdrawn from each account type */
function deductFromAccountsTracked(accounts: Account[], amount: number): WithdrawalResult {
  let remaining = amount;
  const byType: Partial<Record<AccountType, number>> = {};

  const order: Account['type'][] = ['non-registered', 'tfsa', 'fhsa', 'rrsp', 'resp'];

  for (const type of order) {
    if (remaining <= 0) break;
    for (const account of accounts) {
      if (remaining <= 0) break;
      if (account.type === type && account.marketValue > 0) {
        const deduction = Math.min(account.marketValue, remaining);
        account.marketValue -= deduction;
        remaining -= deduction;
        byType[type] = (byType[type] ?? 0) + deduction;
      }
    }
  }

  return { accounts, byType };
}

/** Compute the portfolio-weighted return for the current year's market returns */
function computeWeightedReturnForAccounts(
  accounts: Account[],
  returns: Record<string, number>
): number {
  const totalValue = accounts.reduce((s, a) => s + a.marketValue, 0);
  if (totalValue === 0) return 0;
  let weighted = 0;
  for (const account of accounts) {
    const accountWeight = account.marketValue / totalValue;
    if (account.holdings.length > 0) {
      for (const h of account.holdings) {
        const r = returns[h.assetClass] ?? 0;
        weighted += accountWeight * h.allocation * r;
      }
    } else {
      weighted += accountWeight * (
        (returns['canadian-equity'] ?? 0) * 0.4 +
        (returns['us-equity'] ?? 0) * 0.3 +
        (returns['canadian-bonds'] ?? 0) * 0.3
      );
    }
  }
  return weighted;
}

function distributeContributions(
  accounts: Account[],
  totalAmount: number,
  income: number
): void {
  let remaining = totalAmount;

  // 1. Max out RRSP
  const rrsp = accounts.find((a) => a.type === 'rrsp');
  if (rrsp && remaining > 0) {
    const room = calculateRRSPRoom(income);
    const contribution = Math.min(remaining, room);
    rrsp.marketValue += contribution;
    remaining -= contribution;
  }

  // 2. Max out TFSA
  const tfsa = accounts.find((a) => a.type === 'tfsa');
  if (tfsa && remaining > 0) {
    const contribution = Math.min(remaining, CONTRIBUTION_LIMITS.tfsa);
    tfsa.marketValue += contribution;
    remaining -= contribution;
  }

  // 3. Max out FHSA
  const fhsa = accounts.find((a) => a.type === 'fhsa');
  if (fhsa && remaining > 0) {
    const contribution = Math.min(remaining, CONTRIBUTION_LIMITS.fhsa);
    fhsa.marketValue += contribution;
    remaining -= contribution;
  }

  // 4. Rest goes to non-registered
  const nonReg = accounts.find((a) => a.type === 'non-registered');
  if (nonReg && remaining > 0) {
    nonReg.marketValue += remaining;
  }
}

function calculateMortgagePayment(
  principal: number,
  annualRate: number,
  years: number
): number {
  const monthlyRate = annualRate / 12;
  const numPayments = years * 12;
  return (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
}

// ─── Percentile Calculation ─────────────────────────────────────────────────

function calculatePercentiles(
  allPaths: YearResult[][],
  startYear: number,
  startAge: number
): YearlyPercentiles[] {
  const years = allPaths[0].length;
  const result: YearlyPercentiles[] = [];

  for (let y = 0; y < years; y++) {
    const values = allPaths.map((path) => path[y].netWorth).sort((a, b) => a - b);
    const n = values.length;

    result.push({
      year: startYear + y,
      age: startAge + y,
      p10: values[Math.floor(n * 0.10)],
      p25: values[Math.floor(n * 0.25)],
      p50: values[Math.floor(n * 0.50)],
      p75: values[Math.floor(n * 0.75)],
      p90: values[Math.floor(n * 0.90)],
      mean: values.reduce((a, b) => a + b, 0) / n,
    });
  }

  return result;
}

// ─── Summary Calculation ────────────────────────────────────────────────────

function calculateSummary(
  allPaths: YearResult[][],
  profile: FinancialProfile,
  scenario: ScenarioOverrides,
  startYear: number
): SimulationSummary {
  const retirementAge = scenario.retirementAge ?? profile.retirementAge;
  const lifeExpectancy = scenario.lifeExpectancy ?? profile.lifeExpectancy;
  const inflationRate = scenario.inflationRate ?? profile.inflationRate;
  const yearsToRetirement = retirementAge - profile.age;
  const years = allPaths[0].length;

  // Net worth at retirement year
  const retirementYearIndex = Math.min(yearsToRetirement, years - 1);
  const retirementValues = allPaths
    .map((path) => path[retirementYearIndex].netWorth)
    .sort((a, b) => a - b);

  const n = retirementValues.length;

  // Retirement success: paths where net worth > 0 at life expectancy
  const lifeExpectancyIndex = Math.min(
    lifeExpectancy - profile.age,
    years - 1
  );
  const survivingPaths = allPaths.filter(
    (path) => path[lifeExpectancyIndex].netWorth > 0
  ).length;

  // Probability of ruin
  const ruinedPaths = allPaths.filter((path) =>
    path.some((v, i) => i >= yearsToRetirement && v.netWorth <= 0)
  ).length;

  // Peak net worth year
  const medianPath = allPaths[Math.floor(n / 2)];
  let peakYear = 0;
  let peakValue = 0;
  for (let y = 0; y < years; y++) {
    if (medianPath[y].netWorth > peakValue) {
      peakValue = medianPath[y].netWorth;
      peakYear = startYear + y;
    }
  }

  // Goal outcomes
  const goalOutcomes: GoalOutcome[] = profile.goals.map((goal) => {
    const targetYearIndex = Math.min(goal.targetYear - startYear, years - 1);
    const successCount = allPaths.filter(
      (path) => path[Math.max(0, targetYearIndex)].netWorth >= goal.targetAmount
    ).length;

    // Median year achieved
    const achievedYears = allPaths
      .map((path) => {
        const idx = path.findIndex((v) => v.netWorth >= goal.targetAmount);
        return idx >= 0 ? startYear + idx : null;
      })
      .filter((y): y is number => y !== null)
      .sort((a, b) => a - b);

    return {
      goal,
      probabilityOfSuccess: successCount / n,
      medianYearAchieved: achievedYears.length > 0
        ? achievedYears[Math.floor(achievedYears.length / 2)]
        : null,
      shortfallP50: Math.max(
        0,
        goal.targetAmount -
          (retirementValues[Math.floor(n * 0.5)] || 0)
      ),
    };
  });

  // Final year values for best/worst case
  const finalValues = allPaths.map((p) => p[years - 1].netWorth).sort((a, b) => a - b);

  // Years to first goal (if any)
  let yearsToGoal: number | null = null;
  if (profile.goals.length > 0) {
    const medianAchieved = goalOutcomes[0]?.medianYearAchieved;
    if (medianAchieved) {
      yearsToGoal = medianAchieved - startYear;
    }
  }

  // ── New income-based metrics ──

  // Retirement annual income at first retirement year (P50, deflated to today's dollars)
  const firstRetirementIndex = Math.min(yearsToRetirement, years - 1);
  const inflationAtRetirement = Math.pow(1 + inflationRate, yearsToRetirement);

  const retirementIncomes = allPaths
    .map((path) => {
      const yr = path[firstRetirementIndex];
      // Net retirement income = gross - all taxes (RRSP tax + gov income tax)
      const totalRetirementGross = yr.govPensionIncome + yr.portfolioWithdrawal;
      const totalTax = yr.rrspTaxPaid + yr.govIncomeTaxPaid;
      const netRetirementIncome = (totalRetirementGross - totalTax) / inflationAtRetirement;
      return netRetirementIncome;
    })
    .sort((a, b) => a - b);

  const retirementAnnualIncomeP50 = retirementIncomes[Math.floor(n * 0.5)];

  // Income replacement ratio - net-to-net comparison
  // Working income: after tax (with RRSP deduction)
  const rrspRoom = calculateRRSPRoom(profile.annualIncome);
  const typicalRRSPContribution = Math.min(profile.annualIncome * (scenario.annualSavingsRate ?? profile.annualSavingsRate), rrspRoom);
  const taxableWorkingIncome = profile.annualIncome - typicalRRSPContribution;
  const workingIncomeTax = calculateIncomeTax(taxableWorkingIncome, profile.province);
  const afterTaxWorkingIncome = profile.annualIncome - workingIncomeTax;

  const incomeReplacementTarget = afterTaxWorkingIncome;
  const incomeReplacementRatio = incomeReplacementTarget > 0
    ? retirementAnnualIncomeP50 / incomeReplacementTarget
    : 0;

  // Money lasts to age: P50 of the age when net worth permanently depletes.
  // Scan backwards to find the last year with positive net worth; permanent
  // depletion starts the year after. This ignores temporary dips to $0 that
  // recover (e.g., a bad market year followed by continued income/savings).
  const depletionAges = allPaths
    .map((path) => {
      for (let i = years - 1; i >= 0; i--) {
        if (path[i].netWorth > 0) {
          if (i === years - 1) return lifeExpectancy; // never runs out
          return profile.age + i + 1; // permanent depletion starts after last positive year
        }
      }
      return profile.age; // depleted from the start
    })
    .sort((a, b) => a - b);

  const moneyLastsToAge = depletionAges[Math.floor(n * 0.5)];

  // CPP/OAS at 65 in today's dollars
  const govAt65 = calculateGovernmentPensionsAtAge65(profile.cppBenefitRate ?? 0.65);
  const cppOasAnnualIncome = govAt65.total;

  return {
    retirementNetWorthP50: retirementValues[Math.floor(n * 0.5)],
    retirementNetWorthP10: retirementValues[Math.floor(n * 0.1)],
    retirementNetWorthP90: retirementValues[Math.floor(n * 0.9)],
    retirementSuccessRate: survivingPaths / n,
    yearsToGoal,
    peakNetWorthYear: peakYear,
    worstCaseNetWorth: finalValues[Math.floor(n * 0.05)],
    bestCaseNetWorth: finalValues[Math.floor(n * 0.95)],
    probabilityOfRuin: ruinedPaths / n,
    goalOutcomes,
    retirementAnnualIncomeP50,
    incomeReplacementRatio,
    incomeReplacementTarget,
    moneyLastsToAge,
    cppOasAnnualIncome,
  };
}

export { simulateSinglePath };
