import type { AccountType, Province } from '@/lib/types';

// ─── 2025 Federal Tax Brackets ──────────────────────────────────────────────
// Source: CRA / TaxTips.ca 2025 Federal Rates
// Note: 14.50% first-bracket rate is the effective 2025 rate (15% Jan-Jun, 14% Jul-Dec)

interface TaxBracket {
  min: number;
  max: number;
  rate: number;
}

const FEDERAL_BRACKETS: TaxBracket[] = [
  { min: 0, max: 57375, rate: 0.145 },
  { min: 57375, max: 114750, rate: 0.205 },
  { min: 114750, max: 177882, rate: 0.26 },
  { min: 177882, max: 253414, rate: 0.29 },
  { min: 253414, max: Infinity, rate: 0.33 },
];

// ─── Provincial Tax Brackets (2025) ─────────────────────────────────────────
// Full brackets for ON, BC, AB, QC (covers >80% of Canadians).
// Other provinces fall back to a flat effective rate.

const PROVINCIAL_BRACKETS: Partial<Record<Province, TaxBracket[]>> = {
  ON: [
    { min: 0, max: 51446, rate: 0.0505 },
    { min: 51446, max: 102894, rate: 0.0915 },
    { min: 102894, max: 150000, rate: 0.1116 },
    { min: 150000, max: 220000, rate: 0.1216 },
    { min: 220000, max: Infinity, rate: 0.1316 },
  ],
  BC: [
    { min: 0, max: 47937, rate: 0.0506 },
    { min: 47937, max: 95875, rate: 0.0770 },
    { min: 95875, max: 110076, rate: 0.1050 },
    { min: 110076, max: 133664, rate: 0.1229 },
    { min: 133664, max: Infinity, rate: 0.1470 },
  ],
  AB: [
    { min: 0, max: 148269, rate: 0.10 },
    { min: 148269, max: 177922, rate: 0.12 },
    { min: 177922, max: 237230, rate: 0.13 },
    { min: 237230, max: Infinity, rate: 0.14 },
  ],
  QC: [
    { min: 0, max: 51780, rate: 0.14 },
    { min: 51780, max: 103545, rate: 0.19 },
    { min: 103545, max: 126000, rate: 0.24 },
    { min: 126000, max: Infinity, rate: 0.2575 },
  ],
};

// Flat rates for provinces without full brackets (effective at ~$100K income)
const PROVINCIAL_FLAT_RATES: Record<Province, number> = {
  ON: 0.0915,
  BC: 0.0770,
  AB: 0.10,
  QC: 0.15,
  MB: 0.1275,
  SK: 0.105,
  NS: 0.0879,
  NB: 0.0940,
  NL: 0.087,
  PE: 0.098,
  YT: 0.09,
  NT: 0.059,
  NU: 0.04,
};

// Provincial Basic Personal Amounts (2025)
// Used to calculate provincial BPA tax credits
const PROVINCIAL_BPA: Record<Province, number> = {
  ON: 11865,
  BC: 12580,
  AB: 21003,
  QC: 17183,
  MB: 15780,
  SK: 17661,
  NS: 8481,
  NB: 13044,
  NL: 10818,
  PE: 13500,
  YT: 16129,
  NT: 16593,
  NU: 17925,
};

// ─── Contribution Limits (2025) ─────────────────────────────────────────────
// Source: CRA Contribution Limits
// https://www.canada.ca/en/revenue-agency/services/tax/registered-plans-administrators/pspa/mp-rrsp-dpsp-tfsa-limits-ympe.html

export const CONTRIBUTION_LIMITS = {
  tfsa: 7000,
  rrsp_rate: 0.18,     // 18% of earned income
  rrsp_max: 32490,
  fhsa: 8000,
  fhsa_lifetime: 40000,
};

// ─── Tax Calculations ───────────────────────────────────────────────────────

/** Calculate federal income tax */
function calculateFederalTax(taxableIncome: number): number {
  let tax = 0;
  for (const bracket of FEDERAL_BRACKETS) {
    if (taxableIncome <= bracket.min) break;
    const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
    tax += taxableInBracket * bracket.rate;
  }
  return tax;
}

/** Calculate provincial tax using brackets when available, flat rate otherwise */
function calculateProvincialTax(taxableIncome: number, province: Province): number {
  const brackets = PROVINCIAL_BRACKETS[province];
  if (brackets) {
    let tax = 0;
    for (const bracket of brackets) {
      if (taxableIncome <= bracket.min) break;
      const taxableInBracket = Math.min(taxableIncome, bracket.max) - bracket.min;
      tax += taxableInBracket * bracket.rate;
    }
    return tax;
  }
  return taxableIncome * PROVINCIAL_FLAT_RATES[province];
}

/** Calculate total income tax (federal + provincial) */
export function calculateIncomeTax(taxableIncome: number, province: Province): number {
  const federalTax = calculateFederalTax(taxableIncome);
  const provincialTax = calculateProvincialTax(taxableIncome, province);

  // Federal BPA credit: $16,129 x 14.5% = $2,339
  const federalBpaCredit = 16129 * 0.145;

  // Provincial BPA credit: BPA * lowest provincial bracket rate
  const brackets = PROVINCIAL_BRACKETS[province];
  const lowestProvRate = brackets ? brackets[0].rate : PROVINCIAL_FLAT_RATES[province];
  const provincialBpaCredit = PROVINCIAL_BPA[province] * lowestProvRate;

  return Math.max(0, federalTax + provincialTax - federalBpaCredit - provincialBpaCredit);
}

/** Calculate tax on investment gains based on account type */
export function calculateInvestmentTax(
  gains: number,
  accountType: AccountType,
  province: Province,
  marginalRate?: number
): number {
  if (gains <= 0) return 0;

  switch (accountType) {
    case 'tfsa':
    case 'fhsa':
      // Tax-free growth
      return 0;

    case 'rrsp':
      // Tax-deferred; taxed as income on withdrawal
      // During accumulation, no tax on gains
      return 0;

    case 'resp':
      // Growth is tax-free inside, taxed to student on withdrawal (usually low bracket)
      return 0;

    case 'non-registered': {
      // Capital gains: 50% inclusion rate
      // The proposed increase to 66.67% for gains above $250K was cancelled in March 2025
      const inclusionRate = 0.5;
      const taxableGains = gains * inclusionRate;
      const rate = marginalRate ?? estimateMarginalRate(0, province);
      return taxableGains * rate;
    }

    default:
      return 0;
  }
}

/** Estimate marginal tax rate for a given income level */
export function estimateMarginalRate(income: number, province: Province): number {
  // Find federal marginal bracket
  let federalRate = 0.15;
  for (const bracket of FEDERAL_BRACKETS) {
    if (income > bracket.min) {
      federalRate = bracket.rate;
    }
  }

  // Find provincial marginal rate
  const brackets = PROVINCIAL_BRACKETS[province];
  let provincialRate = PROVINCIAL_FLAT_RATES[province];
  if (brackets) {
    for (const bracket of brackets) {
      if (income > bracket.min) {
        provincialRate = bracket.rate;
      }
    }
  }

  return federalRate + provincialRate;
}

/** Calculate annual RRSP contribution room */
export function calculateRRSPRoom(earnedIncome: number): number {
  return Math.min(earnedIncome * CONTRIBUTION_LIMITS.rrsp_rate, CONTRIBUTION_LIMITS.rrsp_max);
}

/** Calculate after-tax withdrawal from RRSP */
export function calculateRRSPWithdrawalTax(
  amount: number,
  otherIncome: number,
  province: Province
): number {
  const totalIncome = otherIncome + amount;
  const totalTax = calculateIncomeTax(totalIncome, province);
  const baseTax = calculateIncomeTax(otherIncome, province);
  return totalTax - baseTax;
}
