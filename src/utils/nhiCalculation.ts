// National Health Insurance (国民健康保険) calculation logic
// Each municipality has its own rates; add new cities as additional exported functions.

export type AgeGroup = 'under40' | '40to64' | '65over';

export interface NhiBreakdown {
  medical: number;
  support: number;
  kaigo: number;   // 0 unless age 40–64
  kodomo: number;
  total: number;
}

/**
 * Compute the NHI assessment base (算定基礎額).
 * base = max(0, totalIncome − 基礎控除 430,000)
 *
 * @param salaryGross  Total gross salary across all salary income entries
 * @param bizIncome    Total net business/misc income (revenue − expenses)
 */
export function computeNhiBase(salaryGross: number, bizIncome: number): number {
  let empDeduction = 0;
  if (salaryGross <= 1625000) empDeduction = Math.min(salaryGross, 550000);
  else if (salaryGross <= 1800000) empDeduction = salaryGross * 0.4 - 100000;
  else if (salaryGross <= 3600000) empDeduction = salaryGross * 0.3 + 80000;
  else if (salaryGross <= 6600000) empDeduction = salaryGross * 0.2 + 440000;
  else if (salaryGross <= 8500000) empDeduction = salaryGross * 0.1 + 1100000;
  else empDeduction = 1950000;
  const empIncome = Math.max(0, salaryGross - empDeduction);
  return Math.max(0, empIncome + bizIncome - 430000);
}

// ─────────────────────────────────────────────────────────────────────────────
// Municipality rate tables
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 千代田区 (Chiyoda-ku) — 令和8年度 (FY2026)
 * Source: https://www.city.chiyoda.lg.jp/koho/kurashi/hoken/kenkohoken/kesan.html
 */
export function calculateChiyodaNhi(base: number, ageGroup: AgeGroup): NhiBreakdown {
  const medical = Math.min(Math.round(base * 0.0751) + 47600, 670000);
  const support = Math.min(Math.round(base * 0.028)  + 17600, 260000);
  const kaigo   = ageGroup === '40to64'
    ? Math.min(Math.round(base * 0.0243) + 17800, 170000)
    : 0;
  const kodomo  = Math.min(Math.round(base * 0.0027) + 1873,  30000);
  return { medical, support, kaigo, kodomo, total: medical + support + kaigo + kodomo };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher — add new cities here
// ─────────────────────────────────────────────────────────────────────────────

/** City IDs that have municipality auto-calculation logic. */
const SUPPORTED_MUNICIPALITY_CITIES = new Set(['chiyoda']);

export function isMunicipalitySupported(city: string): boolean {
  return SUPPORTED_MUNICIPALITY_CITIES.has(city);
}

/**
 * Returns a breakdown for the given city, or null if the city is not supported.
 */
export function calculateMunicipalityNhi(
  city: string,
  base: number,
  ageGroup: AgeGroup,
): NhiBreakdown | null {
  switch (city) {
    case 'chiyoda': return calculateChiyodaNhi(base, ageGroup);
    default:        return null;
  }
}
