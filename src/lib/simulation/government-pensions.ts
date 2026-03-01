// ─── CPP/OAS/GIS Government Pension Calculator ──────────────────────────────
//
// CPP: max $18,092/year ($1,507.65/month) at 65 (2025 dollars)
//   - Reduced 7.2%/year if taken early (min age 60)
//   - Increased 8.4%/year if deferred (max age 70)
//   - Default cppBenefitRate = 0.65 for a median earner
//   Source: https://www.canada.ca/en/services/benefits/publicpensions/cpp/payment-amounts.html
//
// OAS: $8,908/year ($742.31/month) at ages 65-74
//   Ages 75+: $9,799/year ($816.54/month)
//   Clawed back 15% on income above $93,454 threshold
//   Full elimination at $148,451 (65-74) or $154,196 (75+)
//   Source: https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/payments.html
//
// GIS (Guaranteed Income Supplement):
//   Max $13,305/year ($1,108.74/month) for single recipients
//   Income threshold: $22,488 (single)
//   Clawback rate: 50% on income excluding OAS
//   Source: https://www.canada.ca/en/services/benefits/publicpensions/old-age-security/guaranteed-income-supplement/benefit-amount.html
//
// All benefits are inflation-indexed in the simulation.

export interface GovernmentPensionParams {
  cppStartAge: number;      // default 65
  oasStartAge: number;      // default 65
  cppBenefitRate: number;   // 0-1, fraction of max CPP (default 0.65)
}

export interface AnnualGovernmentIncome {
  cpp: number;
  oas: number;
  gis: number;
  total: number;
}

// 2025 baseline amounts (today's dollars)
const CPP_MAX_AT_65 = 18092;
const OAS_ANNUAL_65_TO_74 = 8908;
const OAS_ANNUAL_75_PLUS = 9799;
const OAS_CLAWBACK_THRESHOLD = 93454;
const OAS_CLAWBACK_RATE = 0.15;

// GIS parameters (single, 2025)
const GIS_MAX_ANNUAL_SINGLE = 13305;
const GIS_INCOME_THRESHOLD_SINGLE = 22488;
const GIS_CLAWBACK_RATE = 0.50;

// Adjustment rates per year away from 65
const CPP_EARLY_REDUCTION_PER_YEAR = 0.072;  // 7.2%/year before 65
const CPP_LATE_INCREASE_PER_YEAR = 0.084;    // 8.4%/year after 65

const DEFAULT_PARAMS: GovernmentPensionParams = {
  cppStartAge: 65,
  oasStartAge: 65,
  cppBenefitRate: 0.65,
};

/**
 * Calculate CPP benefit for a given start age and benefit rate.
 * Returns annual amount in today's dollars (before inflation indexing).
 */
function calculateCPPBenefit(startAge: number, benefitRate: number): number {
  const clampedAge = Math.max(60, Math.min(70, startAge));
  let adjustmentFactor = 1;

  if (clampedAge < 65) {
    adjustmentFactor = 1 - CPP_EARLY_REDUCTION_PER_YEAR * (65 - clampedAge);
  } else if (clampedAge > 65) {
    adjustmentFactor = 1 + CPP_LATE_INCREASE_PER_YEAR * (clampedAge - 65);
  }

  return CPP_MAX_AT_65 * benefitRate * adjustmentFactor;
}

/**
 * Calculate OAS benefit for a given age, with clawback based on other income.
 * Returns annual amount in today's dollars (before inflation indexing).
 * Ages 75+ receive a higher base amount.
 */
function calculateOASBenefit(otherIncome: number, age: number): number {
  const baseOAS = age >= 75 ? OAS_ANNUAL_75_PLUS : OAS_ANNUAL_65_TO_74;

  if (otherIncome <= OAS_CLAWBACK_THRESHOLD) {
    return baseOAS;
  }
  const clawback = (otherIncome - OAS_CLAWBACK_THRESHOLD) * OAS_CLAWBACK_RATE;
  return Math.max(0, baseOAS - clawback);
}

/**
 * Calculate GIS (Guaranteed Income Supplement) for low-income retirees.
 * GIS is income-tested: 50% clawback on income excluding OAS itself.
 * Only available at age 65+.
 * Returns annual amount in today's dollars (before inflation indexing).
 */
export function calculateGIS(annualIncomeExcludingOAS: number): number {
  if (annualIncomeExcludingOAS >= GIS_INCOME_THRESHOLD_SINGLE) {
    return 0;
  }
  if (annualIncomeExcludingOAS <= 0) {
    return GIS_MAX_ANNUAL_SINGLE;
  }
  const clawback = annualIncomeExcludingOAS * GIS_CLAWBACK_RATE;
  return Math.max(0, GIS_MAX_ANNUAL_SINGLE - clawback);
}

/**
 * Calculate government pension income for a specific simulation year.
 *
 * @param age - The person's age in this simulation year
 * @param inflationFactor - Cumulative inflation factor from simulation start (e.g. 1.02^year)
 * @param portfolioWithdrawal - Estimated portfolio withdrawal this year (for OAS clawback calc)
 * @param params - CPP/OAS parameters
 * @returns Annual government income in nominal (inflated) dollars for this year
 */
export function calculateGovernmentPensions(
  age: number,
  inflationFactor: number,
  portfolioWithdrawal: number,
  params: Partial<GovernmentPensionParams> = {}
): AnnualGovernmentIncome {
  const p = { ...DEFAULT_PARAMS, ...params };

  let cpp = 0;
  let oas = 0;
  let gis = 0;

  // CPP starts at cppStartAge
  if (age >= p.cppStartAge) {
    const baseCpp = calculateCPPBenefit(p.cppStartAge, p.cppBenefitRate);
    cpp = baseCpp * inflationFactor;
  }

  // OAS starts at oasStartAge
  if (age >= p.oasStartAge) {
    // For clawback, estimate other income in nominal dollars
    const otherIncomeNominal = portfolioWithdrawal + cpp;
    const baseOas = calculateOASBenefit(otherIncomeNominal / inflationFactor, age);
    oas = baseOas * inflationFactor;

    // GIS: income-tested against income excluding OAS, in today's dollars
    const incomeExcludingOAS = otherIncomeNominal / inflationFactor;
    const baseGis = calculateGIS(incomeExcludingOAS);
    gis = baseGis * inflationFactor;
  }

  return { cpp, oas, gis, total: cpp + oas + gis };
}

/**
 * Calculate government pension income at age 65 in today's dollars.
 * Useful for display/summary purposes.
 */
export function calculateGovernmentPensionsAtAge65(
  cppBenefitRate: number = DEFAULT_PARAMS.cppBenefitRate
): AnnualGovernmentIncome {
  const cpp = calculateCPPBenefit(65, cppBenefitRate);
  const oas = calculateOASBenefit(cpp, 65); // only CPP as other income at this point
  const gis = calculateGIS(cpp); // GIS based on CPP income only
  return { cpp, oas, gis, total: cpp + oas + gis };
}

// Export constants for use in insights/limitations
export { GIS_INCOME_THRESHOLD_SINGLE, GIS_MAX_ANNUAL_SINGLE, OAS_CLAWBACK_THRESHOLD };
