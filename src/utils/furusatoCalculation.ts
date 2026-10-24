import { FURUSATO_RULES as rules, INCOME_TAX_BRACKETS } from '../data/furusato.ts'

export interface FurusatoCalculationInput {
  totalIncome: number // salary after employment deduction + net business income
  taxableIncome: number // before the donation deduction, unrounded
  residentTaxableIncome: number
  residentIncomeLevy: number // after adjustment credit, before other credits; no flat taxes
  personalDeductionDifference: number // statutory personal differences, including basic ¥50,000
  incomeTaxBasicExemption: number
  homeLoanCredit: number
}

export interface DonationTaxBenefit {
  incomeDeduction: number
  incomeTaxSaving: number
  residentBasicCredit: number
  residentSpecialCredit: number
  residentTaxCredit: number
  homeLoanResidentCreditChange: number
  totalTaxSaving: number
}

export interface FurusatoCalculationResult extends DonationTaxBenefit {
  maxDonation: number // estimated donation with ¥2,000 net cost, including the ¥2,000
  maxTaxReduction: number
  outOfPocket: number
  specialCreditRate: number
}

export function incomeTaxRate(taxableIncome: number): number {
  return INCOME_TAX_BRACKETS.find((b) => taxableIncome >= b.threshold)?.rate ?? 0
}

export function baseIncomeTax(taxableIncome: number): number {
  const bracket = INCOME_TAX_BRACKETS.find((b) => taxableIncome >= b.threshold)
  return bracket ? taxableIncome * bracket.rate - bracket.deduction : 0
}

export interface HomeLoanTaxes {
  incomeTax: number
  incomeCredit: number
  residentCredit: number
}

/** The existing home-loan model: 5% / ¥97,500 resident spillover ceiling. */
export function homeLoanTaxes(
  taxableIncome: number,
  credit: number,
  basicExemption: number,
): HomeLoanTaxes {
  const tax = baseIncomeTax(taxableIncome)
  const incomeCredit = Math.min(Math.max(0, credit), tax)
  // The 2025 basic-exemption increase is added back for the resident credit ceiling.
  // https://www.city.hiroshima.lg.jp/living/zei/1006016/1025578/1003372.html
  const residentLimit = Math.min(
    97500,
    (Math.max(0, taxableIncome) + Math.max(0, basicExemption - 480000)) * 0.05,
  )
  return {
    incomeTax: (tax - incomeCredit) * rules.reconstructionMultiplier,
    incomeCredit,
    residentCredit: Math.min(Math.max(0, credit - incomeCredit), residentLimit),
  }
}

export function furusatoSpecialCreditRate(input: FurusatoCalculationInput): number {
  // MIC explicitly distinguishes this deemed rate from the actual income-tax rate.
  // Updated personal adjustment: Hiroshima City's official 2026 explanation.
  // https://www.city.hiroshima.lg.jp/living/zei/1006016/1025578/1019117.html
  const rateBase =
    input.residentTaxableIncome -
    input.personalDeductionDifference -
    Math.max(0, input.incomeTaxBasicExemption - 480000)
  // The resident-tax table uses inclusive upper bounds (unlike the NTA tax brackets).
  const deemedRate = rateBase < 0 ? 0 : incomeTaxRate(Math.max(0, rateBase - 1))
  return 1 - rules.residentBasicRate - deemedRate * rules.reconstructionMultiplier
}

/** Unrounded tax effects: avoid ¥100/¥1,000 rounding artifacts in the limit search. */
export function calculateDonationTaxBenefit(
  input: FurusatoCalculationInput,
  donation: number,
): DonationTaxBenefit {
  const amount = Math.max(0, donation)
  const incomeDeduction = Math.max(
    0,
    Math.min(amount, Math.max(0, input.totalIncome) * rules.incomeDonationCap) - rules.selfPayment,
  )
  const residentNet = Math.max(
    0,
    Math.min(amount, Math.max(0, input.totalIncome) * rules.residentDonationCap) -
      rules.selfPayment,
  )
  const before = homeLoanTaxes(
    input.taxableIncome,
    input.homeLoanCredit,
    input.incomeTaxBasicExemption,
  )
  const after = homeLoanTaxes(
    Math.max(0, input.taxableIncome - incomeDeduction),
    input.homeLoanCredit,
    input.incomeTaxBasicExemption,
  )
  const levy = Math.max(0, input.residentIncomeLevy)
  const residentBasicCredit = residentNet * rules.residentBasicRate
  const residentSpecialCredit = Math.min(
    residentNet * furusatoSpecialCreditRate(input),
    levy * rules.residentSpecialCap,
  )
  const residentTaxCredit = Math.min(
    Math.max(0, levy - after.residentCredit),
    residentBasicCredit + residentSpecialCredit,
  )
  const homeLoanResidentCreditChange =
    Math.min(levy, after.residentCredit) - Math.min(levy, before.residentCredit)
  const incomeTaxSaving = before.incomeTax - after.incomeTax
  return {
    incomeDeduction,
    incomeTaxSaving,
    residentBasicCredit,
    residentSpecialCredit,
    residentTaxCredit,
    homeLoanResidentCreditChange,
    totalTaxSaving: incomeTaxSaving + residentTaxCredit + homeLoanResidentCreditChange,
  }
}

export function calculateFurusato(
  input: FurusatoCalculationInput,
  donation = 0,
): FurusatoCalculationResult {
  const specialCreditRate = furusatoSpecialCreditRate(input)
  const statutoryCeiling = Math.floor(
    Math.min(
      Number.MAX_SAFE_INTEGER,
      Math.max(0, input.totalIncome) * rules.incomeDonationCap,
      Math.max(0, input.totalIncome) * rules.residentDonationCap,
    ),
  )
  // A deduction may cross a bracket or displace a home-loan credit. Find the
  // largest fully recoverable amount with the MIC caps applied to each benefit.
  // Do not use the inverse special-credit formula as the search ceiling: the
  // actual income-tax rate can exceed the deemed rate as well as fall below it.
  let low = rules.selfPayment as number
  let high = Math.max(low, statutoryCeiling)
  while (low < high) {
    const mid = Math.ceil((low + high) / 2)
    const saving = calculateDonationTaxBenefit(input, mid).totalTaxSaving
    if (saving + 1e-7 >= mid - rules.selfPayment) low = mid
    else high = mid - 1
  }
  const maxDonation = low > rules.selfPayment ? low : 0
  const benefit = calculateDonationTaxBenefit(input, donation)
  return {
    ...benefit,
    maxDonation,
    maxTaxReduction: Math.max(0, maxDonation - rules.selfPayment),
    outOfPocket: Math.max(0, donation - benefit.totalTaxSaving),
    specialCreditRate,
  }
}
