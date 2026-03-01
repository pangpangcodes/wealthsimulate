import type { AssetClass, AssetClassParams } from '@/lib/types';

// ─── Asset Class Return Parameters ──────────────────────────────────────────
// Forward-looking estimates (annualized, nominal, before fees)

export const ASSET_CLASS_PARAMS: Record<AssetClass, AssetClassParams> = {
  'canadian-equity': {
    assetClass: 'canadian-equity',
    expectedReturn: 0.065,
    volatility: 0.16,
  },
  'us-equity': {
    assetClass: 'us-equity',
    expectedReturn: 0.075,
    volatility: 0.18,
  },
  'international-equity': {
    assetClass: 'international-equity',
    expectedReturn: 0.06,
    volatility: 0.17,
  },
  'emerging-markets': {
    assetClass: 'emerging-markets',
    expectedReturn: 0.07,
    volatility: 0.22,
  },
  'canadian-bonds': {
    assetClass: 'canadian-bonds',
    expectedReturn: 0.03,
    volatility: 0.05,
  },
  'international-bonds': {
    assetClass: 'international-bonds',
    expectedReturn: 0.025,
    volatility: 0.06,
  },
  'high-yield-bonds': {
    assetClass: 'high-yield-bonds',
    expectedReturn: 0.045,
    volatility: 0.09,
  },
  'gold': {
    assetClass: 'gold',
    expectedReturn: 0.035,
    volatility: 0.15,
  },
  'cash': {
    assetClass: 'cash',
    expectedReturn: 0.025,
    volatility: 0.005,
  },
  'real-estate': {
    assetClass: 'real-estate',
    expectedReturn: 0.055,
    volatility: 0.12,
  },
};

// ─── Correlation Matrix (simplified) ────────────────────────────────────────
// Order: can-eq, us-eq, intl-eq, em, can-bond, intl-bond, hy-bond, gold, cash, re

const CORRELATION_MATRIX: number[][] = [
  [1.00, 0.75, 0.70, 0.65, 0.10, 0.08, 0.35, 0.05, 0.00, 0.30], // canadian-equity
  [0.75, 1.00, 0.80, 0.70, 0.05, 0.03, 0.40, 0.00, 0.00, 0.25], // us-equity
  [0.70, 0.80, 1.00, 0.80, 0.08, 0.10, 0.38, 0.05, 0.00, 0.20], // international-equity
  [0.65, 0.70, 0.80, 1.00, 0.05, 0.08, 0.35, 0.10, 0.00, 0.15], // emerging-markets
  [0.10, 0.05, 0.08, 0.05, 1.00, 0.85, 0.50, 0.15, 0.10, 0.10], // canadian-bonds
  [0.08, 0.03, 0.10, 0.08, 0.85, 1.00, 0.45, 0.20, 0.10, 0.08], // international-bonds
  [0.35, 0.40, 0.38, 0.35, 0.50, 0.45, 1.00, 0.10, 0.05, 0.20], // high-yield-bonds
  [0.05, 0.00, 0.05, 0.10, 0.15, 0.20, 0.10, 1.00, 0.05, 0.10], // gold
  [0.00, 0.00, 0.00, 0.00, 0.10, 0.10, 0.05, 0.05, 1.00, 0.00], // cash
  [0.30, 0.25, 0.20, 0.15, 0.10, 0.08, 0.20, 0.10, 0.00, 1.00], // real-estate
];

const ASSET_CLASS_ORDER: AssetClass[] = [
  'canadian-equity', 'us-equity', 'international-equity', 'emerging-markets',
  'canadian-bonds', 'international-bonds', 'high-yield-bonds',
  'gold', 'cash', 'real-estate',
];

// ─── Seeded Random Number Generation ────────────────────────────────────────

/** Mulberry32: fast, high-quality seeded PRNG */
export function createSeededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller transform: generate standard normal using a seeded random fn */
export function randomNormal(rand: () => number = Math.random): number {
  let u = 0, v = 0;
  while (u === 0) u = rand();
  while (v === 0) v = rand();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// ─── Cholesky Decomposition ─────────────────────────────────────────────────

/** Compute lower triangular Cholesky factor L where LL^T = A */
function choleskyDecomposition(matrix: number[][]): number[][] {
  const n = matrix.length;
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = 0;
      for (let k = 0; k < j; k++) {
        sum += L[i][k] * L[j][k];
      }
      if (i === j) {
        L[i][j] = Math.sqrt(Math.max(0, matrix[i][i] - sum));
      } else {
        L[i][j] = (matrix[i][j] - sum) / (L[j][j] || 1e-10);
      }
    }
  }
  return L;
}

// Pre-compute Cholesky factor
const CHOLESKY_L = choleskyDecomposition(CORRELATION_MATRIX);

// ─── Correlated Returns ─────────────────────────────────────────────────────

/** Generate correlated annual returns for all asset classes */
export function generateCorrelatedReturns(rand?: () => number): Record<AssetClass, number> {
  // Generate independent standard normals
  const z: number[] = ASSET_CLASS_ORDER.map(() => randomNormal(rand));

  // Apply Cholesky to induce correlations
  const correlated: number[] = new Array(z.length).fill(0);
  for (let i = 0; i < z.length; i++) {
    for (let j = 0; j <= i; j++) {
      correlated[i] += CHOLESKY_L[i][j] * z[j];
    }
  }

  // Convert to log-normal returns
  const returns: Partial<Record<AssetClass, number>> = {};
  for (let i = 0; i < ASSET_CLASS_ORDER.length; i++) {
    const ac = ASSET_CLASS_ORDER[i];
    const params = ASSET_CLASS_PARAMS[ac];
    const mu = params.expectedReturn;
    const sigma = params.volatility;

    // Log-normal: R = exp((mu - sigma^2/2) + sigma * Z) - 1
    const logReturn = (mu - (sigma * sigma) / 2) + sigma * correlated[i];
    returns[ac] = Math.exp(logReturn) - 1;
  }

  return returns as Record<AssetClass, number>;
}

/** Apply a market crash override to returns */
export function applyCrashToReturns(
  returns: Record<AssetClass, number>,
  severity: 'mild' | 'moderate' | 'severe',
  rand: () => number = Math.random
): Record<AssetClass, number> {
  const crashMagnitude = { mild: -0.15, moderate: -0.30, severe: -0.45 };
  const magnitude = crashMagnitude[severity];

  const crashed = { ...returns };
  for (const ac of ASSET_CLASS_ORDER) {
    if (ac === 'cash') continue;
    if (ac.includes('bond')) {
      // Bonds less affected
      crashed[ac] = Math.min(crashed[ac], magnitude * 0.3);
    } else if (ac === 'gold') {
      // Gold often rises in crashes
      crashed[ac] = Math.abs(magnitude) * 0.2;
    } else {
      crashed[ac] = magnitude + (rand() * 0.1 - 0.05);
    }
  }
  return crashed;
}

export { ASSET_CLASS_ORDER };
