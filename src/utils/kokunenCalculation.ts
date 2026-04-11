// 国民年金保険料の免除・猶予 (National Pension premium exemption) logic
// Source: https://www.nenkin.go.jp/service/kokunen/menjo/20150428.html

/** FY2026 (令和8年度) full monthly premium */
export const KOKUNEN_MONTHLY_PREMIUM = 17920;

export type PensionExemptionTier = 'full' | '3/4' | '1/2' | '1/4' | 'none';

export interface PensionResult {
  monthlyPremium: number;
  annualPremium: number;
  exemptionTier: PensionExemptionTier;
}

/**
 * Determines the exemption tier based on previous-year total income (前年所得).
 * Assumes no dependents (扶養親族等の数 = 0).
 *
 * Thresholds (no dependents, 社会保険料控除 treated as 0 — conservative simplification):
 *   全額免除:  totalIncome ≤ (0+1)×350,000 + 320,000 = 670,000
 *   4分の3免除: totalIncome ≤ 880,000
 *   半額免除:  totalIncome ≤ 1,280,000
 *   4分の1免除: totalIncome ≤ 1,680,000
 *
 * Note: tiers 2–4 technically add 扶養親族等控除額 + 社会保険料控除額 to the threshold,
 * but with no dependents and no readily available SI figure these are treated as 0.
 */
export function getPensionExemptionTier(totalIncome: number): PensionExemptionTier {
  if (totalIncome <= 670000)  return 'full';
  if (totalIncome <= 880000)  return '3/4';
  if (totalIncome <= 1280000) return '1/2';
  if (totalIncome <= 1680000) return '1/4';
  return 'none';
}

/**
 * Returns the monthly premium and exemption tier for a self-employed person
 * (not enrolled in 厚生年金) based on their total income.
 */
export function calculateNationalPension(totalIncome: number): PensionResult {
  const tier = getPensionExemptionTier(totalIncome);
  // FY2026 monthly premiums per tier (pay 0/4, 1/4, 2/4, 3/4, 4/4 of full)
  const monthly: Record<PensionExemptionTier, number> = {
    'full': 0,
    '3/4':  4480,
    '1/2':  8960,
    '1/4':  13440,
    'none': KOKUNEN_MONTHLY_PREMIUM,
  };
  const monthlyPremium = monthly[tier];
  return { monthlyPremium, annualPremium: monthlyPremium * 12, exemptionTier: tier };
}
