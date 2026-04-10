// Japan income deductions (所得控除) definitions and calculation logic

export type DeductionType =
  | 'life_insurance'
  | 'earthquake_insurance'
  | 'medical_expense'
  | 'furusato'
  | 'ideco'
  | 'spouse'
  | 'dependent_general'
  | 'dependent_specified'
  | 'dependent_aged';

export interface DeductionEntry {
  id: string;
  type: DeductionType;
  value: number; // user-supplied amount or count
}

export interface DeductionMeta {
  type: DeductionType;
  nameEn: string;
  nameJa: string;
  descEn: string;
  descJa: string;
  inputLabelEn: string;
  inputLabelJa: string;
  inputIsCount: boolean;  // true = integer count, false = JPY amount
  maxInput?: number;      // soft cap hint shown to user
  hasCashCost?: boolean;  // true if the contribution itself leaves the user's pocket (e.g. iDeCo)
  isTaxCredit?: boolean;  // true if this offsets taxes directly rather than reducing taxable income
}

export const DEDUCTION_DEFS: Record<DeductionType, DeductionMeta> = {
  life_insurance: {
    type: 'life_insurance',
    nameEn: 'Life Insurance',
    nameJa: '生命保険料控除',
    descEn: 'Annual premium paid (new contracts)',
    descJa: '年間支払保険料 (新契約)',
    inputLabelEn: 'Premium Paid (JPY/year)',
    inputLabelJa: '年間保険料 (円)',
    inputIsCount: false,
    maxInput: 400000,
  },
  earthquake_insurance: {
    type: 'earthquake_insurance',
    nameEn: 'Earthquake Insurance',
    nameJa: '地震保険料控除',
    descEn: 'Annual premium paid',
    descJa: '年間支払保険料',
    inputLabelEn: 'Premium Paid (JPY/year)',
    inputLabelJa: '年間保険料 (円)',
    inputIsCount: false,
    maxInput: 50000,
  },
  medical_expense: {
    type: 'medical_expense',
    nameEn: 'Medical Expenses',
    nameJa: '医療費控除',
    descEn: 'Total out-of-pocket medical costs for household',
    descJa: '世帯の自己負担医療費合計',
    inputLabelEn: 'Total Medical Costs (JPY/year)',
    inputLabelJa: '医療費合計 (円)',
    inputIsCount: false,
  },
  furusato: {
    type: 'furusato',
    nameEn: 'Furusato Nozei',
    nameJa: 'ふるさと納税',
    descEn: 'Total donations — credits directly against income & resident tax (net cost: ¥2,000)',
    descJa: '寄附金合計 — 所得税・住民税から直接控除（実質負担：¥2,000）',
    inputLabelEn: 'Total Donation (JPY)',
    inputLabelJa: '寄附金合計 (円)',
    inputIsCount: false,
    isTaxCredit: true,
    hasCashCost: true, // full donation leaves user's pocket; tax credits offset (donation-2000) back
  },
  ideco: {
    type: 'ideco',
    nameEn: 'iDeCo / Small Enterprise Mutual Aid',
    nameJa: '小規模企業共済等掛金控除 (iDeCo)',
    descEn: 'Monthly contribution (max ¥23,000 for company employees)',
    descJa: '月額掛金 (会社員の上限: 月¥23,000)',
    inputLabelEn: 'Monthly Contribution (JPY)',
    inputLabelJa: '月額掛金 (円)',
    inputIsCount: false,
    maxInput: 23000,
    hasCashCost: true,  // contributions go into a locked account, reducing disposable income
  },
  spouse: {
    type: 'spouse',
    nameEn: 'Spouse Deduction',
    nameJa: '配偶者控除',
    descEn: "Spouse's annual income (≤480,000 for full deduction when taxpayer income ≤9M)",
    descJa: '配偶者の年収 (課税所得9百万円以下の場合、48万円以下で満額控除)',
    inputLabelEn: "Spouse's Annual Income (JPY)",
    inputLabelJa: '配偶者の年収 (円)',
    inputIsCount: false,
    maxInput: 1330000,
  },
  dependent_general: {
    type: 'dependent_general',
    nameEn: 'Dependent (General, age 16–18 / 23+)',
    nameJa: '扶養控除 (一般 16〜18歳 / 23歳以上)',
    descEn: '¥380,000 per person',
    descJa: '1人あたり38万円',
    inputLabelEn: 'Number of Dependents',
    inputLabelJa: '人数',
    inputIsCount: true,
  },
  dependent_specified: {
    type: 'dependent_specified',
    nameEn: 'Dependent (Specified, age 19–22)',
    nameJa: '扶養控除 (特定 19〜22歳)',
    descEn: '¥630,000 per person',
    descJa: '1人あたり63万円',
    inputLabelEn: 'Number of Dependents',
    inputLabelJa: '人数',
    inputIsCount: true,
  },
  dependent_aged: {
    type: 'dependent_aged',
    nameEn: 'Dependent (Aged, 70+)',
    nameJa: '扶養控除 (老人 70歳以上)',
    descEn: '¥480,000 per person (cohabiting: ¥580,000)',
    descJa: '1人あたり48万円 (同居の場合は58万円)',
    inputLabelEn: 'Number of Dependents',
    inputLabelJa: '人数',
    inputIsCount: true,
  },
};

export const DEDUCTION_ORDER: DeductionType[] = [
  'ideco',
  'life_insurance',
  'earthquake_insurance',
  'medical_expense',
  'furusato',
  'spouse',
  'dependent_general',
  'dependent_specified',
  'dependent_aged',
];

/**
 * Compute the allowable deduction amount given a user input and the gross income.
 * All values in JPY.
 */
export function calculateDeductionAmount(
  type: DeductionType,
  value: number,
  annualGross: number
): number {
  if (!value || value <= 0) return 0;

  switch (type) {
    case 'life_insurance': {
      // New-contract calculation (each category max ¥40,000, 3 categories max ¥120,000 total)
      // Simplified: treat entire premium as one category
      let d = 0;
      if (value <= 20000) d = value;
      else if (value <= 40000) d = value * 0.5 + 10000;
      else if (value <= 80000) d = value * 0.25 + 20000;
      else d = 40000;
      return Math.min(d, 40000); // single-category cap; user may have multiple categories
    }

    case 'earthquake_insurance':
      return Math.min(value, 50000);

    case 'medical_expense': {
      const threshold = Math.max(annualGross * 0.05, 100000);
      return Math.max(0, Math.min(value - threshold, 2000000));
    }

    case 'furusato':
      // Income tax deduction: donation - 2,000 (simplified; doesn't include resident tax credit)
      return Math.max(0, value - 2000);

    case 'ideco':
      // value is monthly contribution (max ¥23,000 for employees without DB pension)
      return Math.min(value, 23000) * 12;

    case 'spouse': {
      // Spouse income determines deduction; assumes taxpayer gross ≤ ¥9M for full bracket
      const spouseIncome = value;
      if (spouseIncome <= 480000) return 380000;
      if (spouseIncome <= 1050000) return 360000;
      if (spouseIncome <= 1150000) return 310000;
      if (spouseIncome <= 1250000) return 260000;
      if (spouseIncome <= 1350000) return 210000;
      if (spouseIncome <= 1330000) return 160000;
      return 0;
    }

    case 'dependent_general':
      return Math.floor(value) * 380000;

    case 'dependent_specified':
      return Math.floor(value) * 630000;

    case 'dependent_aged':
      return Math.floor(value) * 480000;

    default:
      return 0;
  }
}

/**
 * Returns the actual annual cash outflow for a deduction entry (e.g. iDeCo contributions).
 * This is separate from the tax deduction amount — it represents money that leaves the user's
 * disposable income even though it is not a "withholding" in the payroll sense.
 */
export function getCashCost(entry: DeductionEntry): number {
  if (!DEDUCTION_DEFS[entry.type].hasCashCost) return 0;
  if (!entry.value || entry.value <= 0) return 0;
  switch (entry.type) {
    case 'ideco':
      return Math.min(entry.value, 23000) * 12;
    case 'furusato':
      return entry.value; // full donation amount goes out of pocket; tax credits offset it partially
    default:
      return 0;
  }
}
