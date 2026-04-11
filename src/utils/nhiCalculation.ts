// National Health Insurance (国民健康保険) calculation logic
// Each municipality has its own rates; add new cities as additional exported functions.

export type AgeGroup = 'under40' | '40to64' | '65over';

export interface NhiBreakdown {
  medical: number;
  support: number;
  kaigo: number;    // 0 unless age 40–64
  kodomo: number;
  total: number;
  reduction: 0.7 | 0.5 | 0.2 | 0; // 均等割軽減率 applied
}

/**
 * Compute both the NHI total income (総所得金額等) and assessment base (算定基礎額).
 * - totalIncome is used for 均等割軽減 threshold checks
 * - base = max(0, totalIncome − 基礎控除 430,000) is used for 所得割
 *
 * @param salaryGross  Total gross salary across all salary income entries
 * @param bizIncome    Total net business/misc income (revenue − expenses)
 */
export function computeNhiIncomes(
  salaryGross: number,
  bizIncome: number,
): { totalIncome: number; base: number } {
  let empDeduction = 0;
  if (salaryGross <= 1625000) empDeduction = Math.min(salaryGross, 550000);
  else if (salaryGross <= 1800000) empDeduction = salaryGross * 0.4 - 100000;
  else if (salaryGross <= 3600000) empDeduction = salaryGross * 0.3 + 80000;
  else if (salaryGross <= 6600000) empDeduction = salaryGross * 0.2 + 440000;
  else if (salaryGross <= 8500000) empDeduction = salaryGross * 0.1 + 1100000;
  else empDeduction = 1950000;
  const empIncome = Math.max(0, salaryGross - empDeduction);
  const totalIncome = empIncome + bizIncome;
  const base = Math.max(0, totalIncome - 430000);
  return { totalIncome, base };
}

/** @deprecated Use computeNhiIncomes instead. */
export function computeNhiBase(salaryGross: number, bizIncome: number): number {
  return computeNhiIncomes(salaryGross, bizIncome).base;
}

// ─────────────────────────────────────────────────────────────────────────────
// 均等割額の軽減 (per-capita levy reduction for low-income households)
// Assumes single-person household (insured count = 1, wage earner count = 1).
// Source: https://www.city.chiyoda.lg.jp/koho/kurashi/hoken/kenkohoken/kesan.html
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the 均等割 reduction rate for a single-person household.
 * Thresholds (single wage-earner, 1 insured):
 *   7割軽減: totalIncome ≤ 430,000
 *   5割軽減: totalIncome ≤ 430,000 + 310,000 × 1 = 740,000
 *   2割軽減: totalIncome ≤ 430,000 + 570,000 × 1 = 1,000,000
 */
function kintowariReduction(totalIncome: number): 0.7 | 0.5 | 0.2 | 0 {
  if (totalIncome <= 430000)  return 0.7;
  if (totalIncome <= 740000)  return 0.5;
  if (totalIncome <= 1000000) return 0.2;
  return 0;
}

function applyReduction(amount: number, reduction: number): number {
  return Math.round(amount * (1 - reduction));
}

// ─────────────────────────────────────────────────────────────────────────────
// Municipality rate tables
// ─────────────────────────────────────────────────────────────────────────────

interface WardRates {
  shotokuMedical: number;
  shotokuSupport: number;
  shotokuKaigo:   number;
  shotokuKodomo:  number;
  kintowariMedical: number;
  kintowariSupport: number;
  kintowariKaigo:   number;
  kintowariKodomo:  number;
  capMedical: number;
  capSupport: number;
  capKaigo:   number;
  capKodomo:  number;
}

function calculateWardNhi(
  totalIncome: number,
  base: number,
  ageGroup: AgeGroup,
  rates: WardRates,
): NhiBreakdown {
  const reduction = kintowariReduction(totalIncome);
  const medical = Math.min(Math.round(base * rates.shotokuMedical) + applyReduction(rates.kintowariMedical, reduction), rates.capMedical);
  const support = Math.min(Math.round(base * rates.shotokuSupport) + applyReduction(rates.kintowariSupport, reduction), rates.capSupport);
  const kaigo   = ageGroup === '40to64'
    ? Math.min(Math.round(base * rates.shotokuKaigo) + applyReduction(rates.kintowariKaigo, reduction), rates.capKaigo)
    : 0;
  const kodomo  = Math.min(Math.round(base * rates.shotokuKodomo) + applyReduction(rates.kintowariKodomo, reduction), rates.capKodomo);
  return { medical, support, kaigo, kodomo, total: medical + support + kaigo + kodomo, reduction };
}

/**
 * 東京23区共通レート — 令和8年度 (FY2026)
 * All 23 special wards share the same NHI rates set by Tokyo Metropolitan Government.
 * Sources:
 *   千代田区: https://www.city.chiyoda.lg.jp/koho/kurashi/hoken/kenkohoken/kesan.html
 *   港区:     https://www.city.minato.tokyo.jp/shikaku/kurashi/hoken/kenkohoken/hokenryo.html
 */
const TOKYO_WARD_RATES: WardRates = {
  shotokuMedical: 0.0751, kintowariMedical: 47600, capMedical: 670000,
  shotokuSupport: 0.028,  kintowariSupport: 17600, capSupport: 260000,
  shotokuKaigo:   0.0243, kintowariKaigo:   17800, capKaigo:   170000,
  shotokuKodomo:  0.0027, kintowariKodomo:   1873, capKodomo:   30000,
};

/**
 * 武蔵野市 (Musashino) — 令和8年度 (FY2026)
 * Source: https://www.city.musashino.lg.jp/kurashi_tetsuzuki/kokuminkenkouhoken_kokuminnenkin/kokuminkenkohoken/1052169/1004710.html
 */
const MUSASHINO_RATES: WardRates = {
  shotokuMedical: 0.0579, kintowariMedical: 33000, capMedical: 660000,
  shotokuSupport: 0.0209, kintowariSupport: 12500, capSupport: 260000,
  shotokuKaigo:   0.0184, kintowariKaigo:   15000, capKaigo:   170000,
  shotokuKodomo:  0.0030, kintowariKodomo:   1900, capKodomo:   30000,
};

/**
 * 横浜市 (Yokohama) — 令和8年度 (FY2026)
 * 子ども分 均等割 = ¥1,690 base + ¥80 age-18+ surcharge; adults pay ¥1,770.
 * Source: https://www.city.yokohama.lg.jp/kurashi/koseki-zei-hoken/kokuho/hokenryo/r7hokennryouritu.html
 */
const YOKOHAMA_RATES: WardRates = {
  shotokuMedical: 0.0833, kintowariMedical: 40870, capMedical: 670000,
  shotokuSupport: 0.0262, kintowariSupport: 13380, capSupport: 260000,
  shotokuKaigo:   0.0284, kintowariKaigo:   16200, capKaigo:   170000,
  shotokuKodomo:  0.0034, kintowariKodomo:   1770, capKodomo:   30000,
};

// ─────────────────────────────────────────────────────────────────────────────
// Dispatcher — add new cities here
// ─────────────────────────────────────────────────────────────────────────────

/** City IDs that have municipality auto-calculation logic. */
const SUPPORTED_MUNICIPALITY_CITIES = new Set(['tokyo_23ku', 'musashino', 'yokohama']);

export function isMunicipalitySupported(city: string): boolean {
  return SUPPORTED_MUNICIPALITY_CITIES.has(city);
}

/**
 * Returns a breakdown for the given city, or null if the city is not supported.
 */
export function calculateMunicipalityNhi(
  city: string,
  totalIncome: number,
  base: number,
  ageGroup: AgeGroup,
): NhiBreakdown | null {
  switch (city) {
    case 'tokyo_23ku': return calculateWardNhi(totalIncome, base, ageGroup, TOKYO_WARD_RATES);
    case 'musashino':  return calculateWardNhi(totalIncome, base, ageGroup, MUSASHINO_RATES);
    case 'yokohama':   return calculateWardNhi(totalIncome, base, ageGroup, YOKOHAMA_RATES);
    default:           return null;
  }
}
