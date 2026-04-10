// Home Loan Deduction (住宅借入金等特別控除) data and calculation
// Covers move-in years 2022–2025 under the 0.7% credit rate regime.

export type HomeLoanHouseType =
  | 'certified'            // 認定住宅（長期優良住宅・低炭素住宅）
  | 'zeh'                  // ZEH水準省エネ住宅
  | 'energy_efficient'     // 省エネ基準適合住宅
  | 'other_new'            // その他の新築住宅
  | 'existing_certified'   // 既存住宅（認定住宅等）
  | 'existing_other';      // 既存住宅（その他）

export interface HomeLoanParams {
  moveInYear: number;            // 入居年 (2022–2025)
  houseType: HomeLoanHouseType;
  yearEndBalance: number;        // 年末残高 (JPY)
  deductionYear: number;         // 控除適用年目 (1-based)
}

export interface HomeLoanLimits {
  maxBalance: number;  // 借入限度額
  years: number;       // 控除期間
}

// Labels for each house type (used in wizard UI)
export const HOME_LOAN_HOUSE_TYPES: {
  type: HomeLoanHouseType;
  nameEn: string;
  nameJa: string;
  descEn: string;
  descJa: string;
  isExisting: boolean;
}[] = [
  {
    type: 'certified',
    nameEn: 'Certified Housing',
    nameJa: '認定住宅',
    descEn: 'Long-term quality / low-carbon certified',
    descJa: '長期優良住宅・低炭素住宅',
    isExisting: false,
  },
  {
    type: 'zeh',
    nameEn: 'ZEH-level Energy-saving',
    nameJa: 'ZEH水準省エネ住宅',
    descEn: 'Net-zero energy standard',
    descJa: 'ZEH水準の省エネルギー性能',
    isExisting: false,
  },
  {
    type: 'energy_efficient',
    nameEn: 'Energy-efficient Housing',
    nameJa: '省エネ基準適合住宅',
    descEn: 'Meets energy conservation standards',
    descJa: '省エネルギー基準に適合',
    isExisting: false,
  },
  {
    type: 'other_new',
    nameEn: 'Other New Construction',
    nameJa: 'その他の新築住宅',
    descEn: 'New construction not meeting energy standards',
    descJa: '省エネ基準に該当しない新築住宅',
    isExisting: false,
  },
  {
    type: 'existing_certified',
    nameEn: 'Existing (Certified)',
    nameJa: '既存住宅（認定住宅等）',
    descEn: 'Pre-owned certified / renovated housing',
    descJa: '認定住宅等に該当する中古住宅',
    isExisting: true,
  },
  {
    type: 'existing_other',
    nameEn: 'Existing (Other)',
    nameJa: '既存住宅（その他）',
    descEn: 'Pre-owned general housing',
    descJa: 'その他の中古住宅',
    isExisting: true,
  },
];

// Lookup table: moveInYear → houseType → { maxBalance, years }
// Source: NTA (国税庁) guidelines for 住宅借入金等特別控除
const LIMITS_2022_2023: Record<HomeLoanHouseType, HomeLoanLimits> = {
  certified:          { maxBalance: 50_000_000, years: 13 },
  zeh:                { maxBalance: 45_000_000, years: 13 },
  energy_efficient:   { maxBalance: 40_000_000, years: 13 },
  other_new:          { maxBalance: 30_000_000, years: 13 },
  existing_certified: { maxBalance: 30_000_000, years: 10 },
  existing_other:     { maxBalance: 20_000_000, years: 10 },
};

const LIMITS_2024_2025: Record<HomeLoanHouseType, HomeLoanLimits> = {
  certified:          { maxBalance: 45_000_000, years: 13 },
  zeh:                { maxBalance: 35_000_000, years: 13 },
  energy_efficient:   { maxBalance: 30_000_000, years: 13 },
  other_new:          { maxBalance: 0,          years: 0  },  // generally not eligible
  existing_certified: { maxBalance: 30_000_000, years: 10 },
  existing_other:     { maxBalance: 20_000_000, years: 10 },
};

const LIMITS_BY_YEAR: Record<number, Record<HomeLoanHouseType, HomeLoanLimits>> = {
  2022: LIMITS_2022_2023,
  2023: LIMITS_2022_2023,
  2024: LIMITS_2024_2025,
  2025: LIMITS_2024_2025,
};

export function getHomeLoanLimits(moveInYear: number, houseType: HomeLoanHouseType): HomeLoanLimits {
  const yearTable = LIMITS_BY_YEAR[moveInYear];
  if (!yearTable) return { maxBalance: 0, years: 0 };
  return yearTable[houseType] ?? { maxBalance: 0, years: 0 };
}

export function getAvailableHouseTypes(moveInYear: number): HomeLoanHouseType[] {
  const yearTable = LIMITS_BY_YEAR[moveInYear];
  if (!yearTable) return [];
  return HOME_LOAN_HOUSE_TYPES
    .map(h => h.type)
    .filter(t => yearTable[t].maxBalance > 0);
}

const CREDIT_RATE = 0.007; // 0.7%

/**
 * Calculate the home loan tax credit (住宅借入金等特別控除額).
 * Returns the annual credit amount in JPY.
 *
 * The credit equals: min(yearEndBalance, maxBalance) × 0.7%
 * Returns 0 if the deduction year exceeds the allowed period.
 */
export function calculateHomeLoanCredit(params: HomeLoanParams): number {
  if (!params.yearEndBalance || params.yearEndBalance <= 0) return 0;
  if (!params.deductionYear || params.deductionYear < 1) return 0;

  const limits = getHomeLoanLimits(params.moveInYear, params.houseType);
  if (limits.maxBalance === 0 || limits.years === 0) return 0;
  if (params.deductionYear > limits.years) return 0;

  const effectiveBalance = Math.min(params.yearEndBalance, limits.maxBalance);
  return Math.floor(effectiveBalance * CREDIT_RATE);
}

// Maximum resident tax spillover for post-2022 move-ins
export const HOME_LOAN_RESIDENT_TAX_MAX = 97_500;

/**
 * Compute the resident-tax portion of the home loan credit spillover.
 * For 2022+ move-ins: min(credit remainder, min(97500, taxableIncome × 5%))
 */
export function calculateHomeLoanResidentTaxCredit(
  creditAmount: number,
  incomeTaxBeforeCredit: number,
  taxableIncome: number
): { incomeTaxCredit: number; residentTaxCredit: number } {
  const incomeTaxCredit = Math.min(creditAmount, incomeTaxBeforeCredit);
  const remainder = creditAmount - incomeTaxCredit;
  const residentTaxLimit = Math.min(HOME_LOAN_RESIDENT_TAX_MAX, Math.floor(taxableIncome * 0.05));
  const residentTaxCredit = Math.min(remainder, residentTaxLimit);
  return { incomeTaxCredit, residentTaxCredit };
}
