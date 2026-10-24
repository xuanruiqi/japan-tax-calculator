import { CHILD_SUPPORT_EMPLOYEE_RATE } from '../data/childSupport.ts'

import {
  calculateFurusato,
  homeLoanTaxes,
  incomeTaxRate,
  type FurusatoCalculationResult,
} from './furusatoCalculation.ts'

export interface TaxCalculationResult {
  furusato: FurusatoCalculationResult
  annualGross: number
  healthInsurance: number
  kaigoInsurance: number
  childSupportContribution: number
  pension: number
  incomeTax: number
  marginalRate: number // base bracket rate, e.g. 20
  effectiveMarginalRate: number // with 2.1% surtax, e.g. 20.42
  taxableIncome: number // 課税所得額 (after all deductions, before tax)
  employmentIncomeDeduction: number // 給与所得控除
  employmentIncome: number // 給与所得
  basicExemption: number // 基礎控除
  residentTax: number
  residentTaxPrefectural: number
  residentTaxMunicipal: number
  furusatoIncomeTaxCredit: number // ふるさと納税 — income tax credit portion
  furusatoResidentTaxCredit: number // ふるさと納税 — resident tax credit portion
  homeLoanIncomeTaxCredit: number // 住宅ローン控除 — income tax credit portion
  homeLoanResidentTaxCredit: number // 住宅ローン控除 — resident tax credit portion
  totalDeductions: number
  netPay: number
  monthlyNet: number
  bonusNet: number
  employmentInsurance: number
  nationalPension: number
  nationalHealthInsurance: number
  businessIncome: number
  healthBracket: number
  pensionBracket: number
  healthStandardRemuneration: number
  pensionStandardRemuneration: number
}

const brackets = [
  { min: 0, max: 63000, value: 58000 },
  { min: 63000, max: 73000, value: 68000 },
  { min: 73000, max: 83000, value: 78000 },
  { min: 83000, max: 93000, value: 88000 },
  { min: 93000, max: 101000, value: 98000 },
  { min: 101000, max: 107000, value: 104000 },
  { min: 107000, max: 114000, value: 110000 },
  { min: 114000, max: 122000, value: 118000 },
  { min: 122000, max: 130000, value: 126000 },
  { min: 130000, max: 138000, value: 134000 },
  { min: 138000, max: 146000, value: 142000 },
  { min: 146000, max: 155000, value: 150000 },
  { min: 155000, max: 165000, value: 160000 },
  { min: 165000, max: 175000, value: 170000 },
  { min: 175000, max: 185000, value: 180000 },
  { min: 185000, max: 195000, value: 190000 },
  { min: 195000, max: 210000, value: 200000 },
  { min: 210000, max: 230000, value: 220000 },
  { min: 230000, max: 250000, value: 240000 },
  { min: 250000, max: 270000, value: 260000 },
  { min: 270000, max: 290000, value: 280000 },
  { min: 290000, max: 310000, value: 300000 },
  { min: 310000, max: 330000, value: 320000 },
  { min: 330000, max: 350000, value: 340000 },
  { min: 350000, max: 370000, value: 360000 },
  { min: 370000, max: 395000, value: 380000 },
  { min: 395000, max: 425000, value: 410000 },
  { min: 425000, max: 455000, value: 440000 },
  { min: 455000, max: 485000, value: 470000 },
  { min: 485000, max: 515000, value: 500000 },
  { min: 515000, max: 545000, value: 530000 },
  { min: 545000, max: 575000, value: 560000 },
  { min: 575000, max: 605000, value: 590000 },
  { min: 605000, max: 635000, value: 620000 },
  { min: 635000, max: 665000, value: 650000 },
  { min: 665000, max: 695000, value: 680000 },
  { min: 695000, max: 730000, value: 710000 },
  { min: 730000, max: 770000, value: 750000 },
  { min: 770000, max: 810000, value: 790000 },
  { min: 810000, max: 855000, value: 830000 },
  { min: 855000, max: 905000, value: 880000 },
  { min: 905000, max: 955000, value: 930000 },
  { min: 955000, max: 1005000, value: 980000 },
  { min: 1005000, max: 1060000, value: 1030000 },
  { min: 1060000, max: 1120000, value: 1090000 },
  { min: 1120000, max: 1180000, value: 1150000 },
  { min: 1180000, max: 1240000, value: 1210000 },
  { min: 1240000, max: 1300000, value: 1270000 },
  { min: 1300000, max: 1360000, value: 1330000 },
  { min: 1360000, max: Infinity, value: 1390000 },
]

export function getStandardRemunerationGrade(
  salary: number,
  maxBracketValue: number,
): { value: number; grade: number } {
  if (salary <= 0) return { value: 0, grade: 0 }
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i]
    if (!bracket) continue
    if (salary >= bracket.min && salary < bracket.max) {
      if (bracket.value >= maxBracketValue) {
        const maxIndex = brackets.findIndex((b) => b.value === maxBracketValue)
        return { value: maxBracketValue, grade: maxIndex + 1 }
      }
      return { value: bracket.value, grade: i + 1 }
    }
  }
  const maxIndexFallback = brackets.findIndex((b) => b.value === maxBracketValue)
  return { value: maxBracketValue, grade: maxIndexFallback + 1 }
}

export interface EmployeeChildSupportContribution {
  monthly: number
  bonus: number
  annual: number
}

/** Uses the health insurance remuneration grades and bonus cap, employee share only. */
export function calculateEmployeeChildSupportContribution(
  monthlySalary: number,
  annualBonus: number,
  rate = CHILD_SUPPORT_EMPLOYEE_RATE,
): EmployeeChildSupportContribution {
  const standard = getStandardRemunerationGrade(monthlySalary, 1390000).value
  const bonusStandard = Math.min(Math.floor(Math.max(0, annualBonus) / 1000) * 1000, 5730000)
  const monthly = Math.floor(standard * rate)
  const bonus = Math.floor(bonusStandard * rate)
  return { monthly, bonus, annual: monthly * 12 + bonus }
}

export interface TaxCalculationOptions {
  previousYearGross?: number | null
  healthInsuranceRate?: number
  kaigoInsuranceRate?: number
  childSupportRate?: number // employee share; defaults to the FY2026 statutory rate
  pensionRate?: number
  employmentInsuranceRate?: number
  prefIncomeRate?: number
  cityIncomeRate?: number
  prefPerCapita?: number
  cityPerCapita?: number
  primaryJoinsSocialInsurance?: boolean // whether primary job has SI enrollment (default true)
  nationalPensionAmount?: number // flat 国民年金 amount (when not in 厚生年金)
  nationalHealthInsuranceAmount?: number // 国民健康保険 total (when not in 健康保険)
  additionalSalaryGross?: number // gross salary from non-primary jobs
  additionalHealthInsurance?: number // health insurance from non-primary workplaces
  additionalChildSupportContribution?: number // non-primary insured workplaces
  additionalKaigoInsurance?: number // kaigo insurance from non-primary workplaces
  additionalPension?: number // pension from non-primary workplaces
  additionalEmploymentInsurance?: number // employment insurance from non-primary workplaces
  businessIncome?: number // net 事業所得 (revenue - expenses), summed across all entries
  additionalDeductions?: number // sum of all 所得控除 entered by user (excludes furusato)
  residentAdditionalDeductions?: number // defaults to additionalDeductions for legacy callers
  personalDeductionDifference?: number // spouse/dependents only, excluding the basic difference
  furusatoDonation?: number // full annual donation including the personal contribution
  furusatoNetDonation?: number // donation - 2,000; tax-return income deduction and capped resident credits
  homeLoanCredit?: number // 住宅ローン控除額 — applied before reconstruction surtax
}

export function calculateTaxesAndInsurance(
  monthlySalary: number,
  annualBonus: number,
  options: TaxCalculationOptions = {},
): TaxCalculationResult {
  // --- Social Insurance ---
  const HEALTH_INS_RATE =
    options.healthInsuranceRate !== undefined ? options.healthInsuranceRate : 0.0499 // Default 9.98% / 2
  const KAIGO_RATE = options.kaigoInsuranceRate !== undefined ? options.kaigoInsuranceRate : 0.0
  const PENSION_RATE = options.pensionRate !== undefined ? options.pensionRate : 0.0915 // Default 18.3% / 2
  const EMP_INS_RATE =
    options.employmentInsuranceRate !== undefined ? options.employmentInsuranceRate : 0.006 // Default 0.6%
  const previousYearGross = options.previousYearGross ?? null

  const primaryJoinsSI = options.primaryJoinsSocialInsurance !== false // default true
  const siSalary = primaryJoinsSI ? monthlySalary : 0
  const siBonus = primaryJoinsSI ? annualBonus : 0

  const healthObj = getStandardRemunerationGrade(siSalary, 1390000)
  const pensionObj = getStandardRemunerationGrade(siSalary, 650000)

  const monthlyStandard = healthObj.value
  const healthBracket = healthObj.grade

  const monthlyStandardPension = pensionObj.value
  // Pension grade starts at Health grade 4 (88,000 JPY), so Pension Grade = Health Grade - 3
  const pensionBracket = pensionObj.grade > 0 ? Math.max(1, pensionObj.grade - 3) : 0

  const monthlyHealth = Math.floor(monthlyStandard * HEALTH_INS_RATE)
  const monthlyKaigo = Math.floor(monthlyStandard * KAIGO_RATE)
  const monthlyPension = Math.floor(monthlyStandardPension * PENSION_RATE)

  const bonusStandardHealth = Math.min(Math.floor(siBonus / 1000) * 1000, 5730000)
  const bonusStandardPension = Math.min(Math.floor(siBonus / 1000) * 1000, 1500000)

  const bonusHealth = Math.floor(bonusStandardHealth * HEALTH_INS_RATE)
  const bonusKaigo = Math.floor(bonusStandardHealth * KAIGO_RATE)
  const bonusPension = Math.floor(bonusStandardPension * PENSION_RATE)

  const childSupport = calculateEmployeeChildSupportContribution(
    siSalary,
    siBonus,
    options.childSupportRate,
  )
  const annualChildSupport = childSupport.annual + (options.additionalChildSupportContribution ?? 0)

  const primaryAnnualHealth = monthlyHealth * 12 + bonusHealth
  const primaryAnnualKaigo = monthlyKaigo * 12 + bonusKaigo
  const primaryAnnualPension = monthlyPension * 12 + bonusPension

  const annualHealth = primaryAnnualHealth + (options.additionalHealthInsurance ?? 0)
  const annualKaigo = primaryAnnualKaigo + (options.additionalKaigoInsurance ?? 0)
  const annualPension = primaryAnnualPension + (options.additionalPension ?? 0)

  // --- Income ---
  const primarySalaryGross = monthlySalary * 12 + annualBonus
  const additionalSalaryGross = options.additionalSalaryGross ?? 0
  const totalSalaryGross = primarySalaryGross + additionalSalaryGross
  const businessIncome = options.businessIncome ?? 0
  const annualGross = totalSalaryGross + businessIncome

  // --- Employment Insurance (雇用保険) — calculated on primary salary gross ---
  const annualEmploymentInsurance =
    Math.floor(primarySalaryGross * EMP_INS_RATE) + (options.additionalEmploymentInsurance ?? 0)
  const monthlyEmploymentInsurance = Math.floor(monthlySalary * EMP_INS_RATE)

  const nationalPension = options.nationalPensionAmount ?? 0
  const nationalHealthInsurance = options.nationalHealthInsuranceAmount ?? 0
  const totalSocialInsurance =
    annualChildSupport +
    annualHealth +
    annualKaigo +
    annualPension +
    nationalPension +
    nationalHealthInsurance +
    annualEmploymentInsurance

  // --- Employment Income Deduction (給与所得控除) — on total salary gross ---
  const employmentIncomeDeduction = calculateEmploymentIncomeDeduction(totalSalaryGross)

  const employmentIncome = Math.max(0, totalSalaryGross - employmentIncomeDeduction)
  const totalIncome = employmentIncome + businessIncome

  // --- Basic Exemption (令和7年分以降 / FY2025+) ---
  // Source: https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1199.htm
  let incomeTaxBasicExemption: number
  if (totalIncome <= 1320000) incomeTaxBasicExemption = 950000
  else if (totalIncome <= 3360000) incomeTaxBasicExemption = 880000
  else if (totalIncome <= 4890000) incomeTaxBasicExemption = 680000
  else if (totalIncome <= 6550000) incomeTaxBasicExemption = 630000
  else if (totalIncome <= 23500000) incomeTaxBasicExemption = 580000
  else if (totalIncome <= 24000000) incomeTaxBasicExemption = 480000
  else if (totalIncome <= 24500000) incomeTaxBasicExemption = 320000
  else if (totalIncome <= 25000000) incomeTaxBasicExemption = 160000
  else incomeTaxBasicExemption = 0

  // --- Taxable Income ---
  const extraDeductions = options.additionalDeductions ?? 0
  const taxableIncomeBeforeDonation = Math.max(
    0,
    totalIncome - totalSocialInsurance - incomeTaxBasicExemption - extraDeductions,
  )
  const currentResidentDeductions = options.residentAdditionalDeductions ?? extraDeductions
  const personalDifference =
    (options.personalDeductionDifference ?? 0) + (totalIncome <= 25000000 ? 50000 : 0)
  const currentResidentTaxable = residentTaxableIncome(
    totalIncome,
    totalSocialInsurance,
    currentResidentDeductions,
  )
  const prefRate = options.prefIncomeRate ?? 0.04
  const cityRate = options.cityIncomeRate ?? 0.06
  const currentResidentLevy = residentIncomeLevy(
    totalIncome,
    currentResidentTaxable,
    personalDifference,
    prefRate,
    cityRate,
  )
  const furusatoNet = Math.max(0, options.furusatoNetDonation ?? 0)
  const furusato = calculateFurusato(
    {
      totalIncome,
      taxableIncome: taxableIncomeBeforeDonation,
      residentTaxableIncome: currentResidentTaxable,
      residentIncomeLevy: currentResidentLevy.prefectural + currentResidentLevy.municipal,
      personalDeductionDifference: personalDifference,
      incomeTaxBasicExemption,
      homeLoanCredit: options.homeLoanCredit ?? 0,
    },
    options.furusatoDonation ?? (furusatoNet > 0 ? furusatoNet + 2000 : 0),
  )
  const taxableIncomeTax = Math.max(
    0,
    Math.floor((taxableIncomeBeforeDonation - furusato.incomeDeduction) / 1000) * 1000,
  )

  // --- Resident Tax Pre-Calculation (based on previous year income if provided) ---
  const residentTaxBaseGross =
    previousYearGross !== null && previousYearGross >= 0 ? previousYearGross : annualGross

  let residentEmploymentIncomeDeduction = 0
  if (residentTaxBaseGross <= 1625000)
    residentEmploymentIncomeDeduction = Math.min(residentTaxBaseGross, 550000)
  else if (residentTaxBaseGross <= 1800000)
    residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.4 - 100000
  else if (residentTaxBaseGross <= 3600000)
    residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.3 + 80000
  else if (residentTaxBaseGross <= 6600000)
    residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.2 + 440000
  else if (residentTaxBaseGross <= 8500000)
    residentEmploymentIncomeDeduction = residentTaxBaseGross * 0.1 + 1100000
  else residentEmploymentIncomeDeduction = 1950000

  const residentEmploymentIncome =
    previousYearGross !== null && previousYearGross >= 0
      ? Math.max(0, residentTaxBaseGross - residentEmploymentIncomeDeduction)
      : totalIncome

  let residentSocialInsurance = totalSocialInsurance
  if (previousYearGross !== null && previousYearGross >= 0) {
    // Estimate previous year social insurance as ~14.14% of gross
    residentSocialInsurance = Math.floor(previousYearGross * 0.1414)
  }

  const hasPreviousYear = previousYearGross !== null && previousYearGross >= 0
  const taxableResidentTax = residentTaxableIncome(
    residentEmploymentIncome,
    residentSocialInsurance,
    hasPreviousYear ? 0 : currentResidentDeductions,
  )
  const residentLevy = residentIncomeLevy(
    residentEmploymentIncome,
    taxableResidentTax,
    hasPreviousYear ? (residentEmploymentIncome <= 25000000 ? 50000 : 0) : personalDifference,
    prefRate,
    cityRate,
  )

  // On a tax return the donation reduces taxable income before progressive tax
  // and home-loan credits. It is not a refundable credit at the top marginal rate.
  const marginalRate = incomeTaxRate(taxableIncomeTax) * 100
  const effectiveMarginalRate = parseFloat((marginalRate * 1.021).toFixed(3))
  const homeLoan = homeLoanTaxes(
    taxableIncomeTax,
    options.homeLoanCredit ?? 0,
    incomeTaxBasicExemption,
  )
  const beforeDonation = homeLoanTaxes(
    Math.floor(taxableIncomeBeforeDonation / 1000) * 1000,
    options.homeLoanCredit ?? 0,
    incomeTaxBasicExemption,
  )
  const homeLoanIncomeTaxCredit = homeLoan.incomeCredit
  const incomeTax = Math.floor(homeLoan.incomeTax / 100) * 100
  const furusatoIncomeTaxCredit = Math.floor(beforeDonation.incomeTax / 100) * 100 - incomeTax
  const availableResidentLevy =
    Math.floor(residentLevy.prefectural / 100) * 100 +
    Math.floor(residentLevy.municipal / 100) * 100
  const homeLoanResidentTaxCredit = Math.min(homeLoan.residentCredit, availableResidentLevy)
  const residentIncomeLeviedPrefectural = residentLevy.prefectural
  const residentIncomeLeviedMunicipal = residentLevy.municipal

  // Per capita rate
  const residentPerCapitaPrefectural =
    options.prefPerCapita !== undefined ? options.prefPerCapita : 1500
  const residentPerCapitaMunicipal =
    options.cityPerCapita !== undefined ? options.cityPerCapita : 3500

  // If extremely low income, resident tax is 0.
  // Simplified logic, Tokyo minimum income for single is 1,000,000 for per capita, 450k for income levied.
  let residentTaxPrefectural = 0
  let residentTaxMunicipal = 0

  if (residentEmploymentIncome > 450000) {
    residentTaxPrefectural = residentIncomeLeviedPrefectural + residentPerCapitaPrefectural
    residentTaxMunicipal = residentIncomeLeviedMunicipal + residentPerCapitaMunicipal
  }

  const roundedResidentTaxPrefectural = Math.floor(residentTaxPrefectural / 100) * 100
  const roundedResidentTaxMunicipal = Math.floor(residentTaxMunicipal / 100) * 100
  const roundedResidentTax = roundedResidentTaxPrefectural + roundedResidentTaxMunicipal

  // Donation credits cannot offset per-capita taxes. The Furusato estimate is
  // always based on the donation year's income, even with a prior-year override.
  const furusatoResidentTaxCredit = Math.floor(
    Math.min(
      Math.max(0, availableResidentLevy - homeLoanResidentTaxCredit),
      furusato.residentTaxCredit,
    ),
  )
  const adjustedIncomeTax = incomeTax
  const adjustedResidentTax = Math.max(
    0,
    roundedResidentTax - homeLoanResidentTaxCredit - furusatoResidentTaxCredit,
  )

  const totalDeductions = totalSocialInsurance + adjustedIncomeTax + adjustedResidentTax
  const netPay = annualGross - totalDeductions

  // Monthly/Bonus breakdown approximation
  let monthlyNet = 0
  let bonusNet = 0

  if (annualGross > 0) {
    monthlyNet =
      monthlySalary -
      childSupport.monthly -
      monthlyHealth -
      monthlyKaigo -
      monthlyPension -
      monthlyEmploymentInsurance -
      Math.floor((adjustedIncomeTax + adjustedResidentTax) * (monthlySalary / annualGross))
    if (annualBonus > 0) {
      const bonusEmploymentInsurance = Math.floor(annualBonus * EMP_INS_RATE)
      bonusNet =
        annualBonus -
        childSupport.bonus -
        bonusHealth -
        bonusKaigo -
        bonusPension -
        bonusEmploymentInsurance -
        Math.floor((adjustedIncomeTax + adjustedResidentTax) * (annualBonus / annualGross))
    }
  }

  return {
    furusato,
    annualGross,
    healthInsurance: annualHealth,
    childSupportContribution: annualChildSupport,
    kaigoInsurance: annualKaigo,
    pension: annualPension,
    employmentInsurance: annualEmploymentInsurance,
    nationalPension,
    nationalHealthInsurance,
    businessIncome,
    incomeTax: adjustedIncomeTax,
    marginalRate,
    effectiveMarginalRate,
    taxableIncome: taxableIncomeTax,
    employmentIncomeDeduction,
    employmentIncome,
    basicExemption: incomeTaxBasicExemption,
    residentTax: adjustedResidentTax,
    residentTaxPrefectural: roundedResidentTaxPrefectural,
    residentTaxMunicipal: roundedResidentTaxMunicipal,
    furusatoIncomeTaxCredit,
    furusatoResidentTaxCredit,
    homeLoanIncomeTaxCredit,
    homeLoanResidentTaxCredit,
    totalDeductions,
    netPay,
    monthlyNet,
    bonusNet,
    healthBracket,
    pensionBracket,
    healthStandardRemuneration: monthlyStandard,
    pensionStandardRemuneration: monthlyStandardPension,
  }
}

// Resident basic exemption is based on total income, not gross receipts.
// https://www.city.hiroshima.lg.jp/living/zei/1006016/1025578/1003372.html
function residentTaxableIncome(
  totalIncome: number,
  socialInsurance: number,
  deductions: number,
): number {
  const basic =
    totalIncome <= 24000000
      ? 430000
      : totalIncome <= 24500000
        ? 290000
        : totalIncome <= 25000000
          ? 150000
          : 0
  return Math.max(0, Math.floor((totalIncome - socialInsurance - basic - deductions) / 1000) * 1000)
}

interface ResidentIncomeLevy {
  prefectural: number
  municipal: number
}

function residentIncomeLevy(
  totalIncome: number,
  taxableIncome: number,
  personalDifference: number,
  prefRate: number,
  cityRate: number,
): ResidentIncomeLevy {
  // Retain the app's simplified single-person exemption threshold.
  if (totalIncome <= 450000) return { prefectural: 0, municipal: 0 }
  const adjustment =
    totalIncome > 25000000
      ? 0
      : 0.05 *
        (taxableIncome <= 2000000
          ? Math.min(personalDifference, taxableIncome)
          : Math.max(50000, personalDifference - (taxableIncome - 2000000)))
  const totalRate = prefRate + cityRate
  return {
    prefectural: Math.max(
      0,
      taxableIncome * prefRate - (totalRate > 0 ? (adjustment * prefRate) / totalRate : 0),
    ),
    municipal: Math.max(
      0,
      taxableIncome * cityRate - (totalRate > 0 ? (adjustment * cityRate) / totalRate : 0),
    ),
  }
}

export function calculateEmploymentIncomeDeduction(totalSalaryGross: number): number {
  let employmentIncomeDeduction = 0
  if (totalSalaryGross <= 1625000) {
    employmentIncomeDeduction = Math.min(totalSalaryGross, 550000)
  } else if (totalSalaryGross <= 1800000) {
    employmentIncomeDeduction = totalSalaryGross * 0.4 - 100000
  } else if (totalSalaryGross <= 3600000) {
    employmentIncomeDeduction = totalSalaryGross * 0.3 + 80000
  } else if (totalSalaryGross <= 6600000) {
    employmentIncomeDeduction = totalSalaryGross * 0.2 + 440000
  } else if (totalSalaryGross <= 8500000) {
    employmentIncomeDeduction = totalSalaryGross * 0.1 + 1100000
  } else {
    employmentIncomeDeduction = 1950000
  }

  return employmentIncomeDeduction
}
