import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateDonationTaxBenefit,
  calculateFurusato,
  furusatoSpecialCreditRate,
  type FurusatoCalculationInput,
} from '../furusatoCalculation.ts'
import { calculateTaxesAndInsurance } from '../taxCalculation.ts'
import {
  calculateDeductionAmount,
  calculateResidentDeductionAmount,
} from '../../data/deductions.ts'

const input: FurusatoCalculationInput = {
  totalIncome: 6100000,
  taxableIncome: 3560000,
  residentTaxableIncome: 3760000,
  residentIncomeLevy: 373500,
  personalDeductionDifference: 200000,
  incomeTaxBasicExemption: 480000,
  homeLoanCredit: 0,
}

function close(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`)
}

// Official worked example A (¥150,000 exceeds the special-credit ceiling):
// https://www.city.okazaki.lg.jp/kurashi/zei/1001858/1001814/1001676.html
test('official example: cap special credit at 20% of the income levy', () => {
  const result = calculateFurusato(input, 150000)
  assert.equal(Math.ceil(result.incomeTaxSaving), 30222)
  close(result.residentBasicCredit, 14800)
  close(result.residentSpecialCredit, 74700)
  close(result.residentTaxCredit, 89500)
  close(result.totalTaxSaving, 119721.6)
  close(result.outOfPocket, 30278.4)
  assert.equal(result.maxDonation, Math.floor(74700 / 0.6958 + 2000))
  assert.equal(result.maxTaxReduction, result.maxDonation - 2000)
})

test('official example B: ¥30,000 donation is fully recovered except ¥2,000', () => {
  const result = calculateFurusato(
    {
      ...input,
      totalIncome: 3560000,
      taxableIncome: 2580000,
      residentTaxableIncome: 2630000,
      residentIncomeLevy: 260500,
      personalDeductionDifference: 50000,
    },
    30000,
  )
  close(result.incomeTaxSaving, 2858.8)
  close(result.residentBasicCredit, 2800)
  close(result.residentSpecialCredit, 22341.2)
  close(result.totalTaxSaving, 28000)
  close(result.outOfPocket, 2000)
})

test('all deemed rate bands use resident personal differences and the basic uplift', () => {
  const bands = [
    [-1, 0.9],
    [0, 0.84895],
    [1950000, 0.84895],
    [1950001, 0.7979],
    [3300000, 0.7979],
    [3300001, 0.6958],
    [6950001, 0.66517],
    [9000001, 0.56307],
    [18000001, 0.4916],
    [40000001, 0.44055],
  ]
  for (const [base, rate] of bands) {
    close(
      furusatoSpecialCreditRate({
        ...input,
        residentTaxableIncome: base! + 150000,
        personalDeductionDifference: 50000,
        incomeTaxBasicExemption: 580000,
      }),
      rate!,
    )
  }
})

test('tax return bracket crossing reduces the fully recoverable donation ceiling', () => {
  const nearBracket = { ...input, taxableIncome: 3320000, residentTaxableIncome: 3520000 }
  assert.equal(calculateFurusato(nearBracket).maxDonation, 22000)
  close(calculateDonationTaxBenefit(nearBracket, 22000).totalTaxSaving, 20000)
  assert.ok(calculateDonationTaxBenefit(nearBracket, 23000).totalTaxSaving < 21000)
})

test('different actual and deemed rates must not promise full recovery', () => {
  assert.equal(calculateFurusato({ ...input, taxableIncome: 3290000 }).maxDonation, 0)
})

test('home-loan credits cannot be counted twice or treated as refundable income tax', () => {
  assert.ok(
    calculateFurusato({ ...input, homeLoanCredit: 280000 }).maxDonation <
      calculateFurusato(input).maxDonation,
  )
  const result = calculateFurusato({ ...input, homeLoanCredit: 600000 }, 50000)
  assert.equal(result.maxDonation, 0)
  assert.equal(result.incomeTaxSaving, 0)
  assert.ok(result.outOfPocket > 2000)
  close(result.totalTaxSaving, result.residentTaxCredit + result.homeLoanResidentCreditChange)
})

test('income and resident donation bases are capped at 40% and 30% of total income', () => {
  const result = calculateFurusato({ ...input, totalIncome: 1000000 }, 1000000)
  assert.equal(result.incomeDeduction, 398000)
  assert.equal(result.residentBasicCredit, 29800)
  assert.ok(result.residentSpecialCredit <= 74700)
  assert.ok(result.maxDonation <= 300000)
})

test('empty income, no tax capacity, and donations below the personal contribution', () => {
  const empty = {
    ...input,
    totalIncome: 0,
    taxableIncome: 0,
    residentTaxableIncome: 0,
    residentIncomeLevy: 0,
  }
  assert.equal(calculateFurusato(empty).maxDonation, 0)
  assert.equal(calculateFurusato(empty, 50000).totalTaxSaving, 0)
  for (const amount of [0, 1000, 2000]) {
    const result = calculateFurusato(input, amount)
    assert.equal(result.totalTaxSaving, 0)
    assert.equal(result.outOfPocket, amount)
  }
  const residentOnly = {
    ...input,
    taxableIncome: 0,
    residentTaxableIncome: 100000,
    residentIncomeLevy: 7500,
    personalDeductionDifference: 50000,
    incomeTaxBasicExemption: 950000,
  }
  assert.equal(calculateFurusato(residentOnly).maxDonation, Math.floor(1500 / 0.9 + 2000))
})

test('current-year limit ignores donations, prior-year income and flat resident taxes', () => {
  const baseline = calculateTaxesAndInsurance(500000, 1000000)
  for (const previousYearGross of [null, 0, 1000000, 20000000]) {
    const result = calculateTaxesAndInsurance(500000, 1000000, {
      previousYearGross,
      furusatoNetDonation: 500000,
      prefPerCapita: 20000,
      cityPerCapita: 30000,
    })
    assert.equal(result.furusato.maxDonation, baseline.furusato.maxDonation)
  }
})

test('income, bonus, multiple jobs, business income and social insurance affect the limit', () => {
  const baseline = calculateTaxesAndInsurance(500000, 0).furusato.maxDonation
  assert.ok(calculateTaxesAndInsurance(500000, 1000000).furusato.maxDonation > baseline)
  assert.ok(
    calculateTaxesAndInsurance(500000, 0, { additionalSalaryGross: 1000000 }).furusato.maxDonation >
      baseline,
  )
  assert.ok(
    calculateTaxesAndInsurance(500000, 0, { businessIncome: 1000000 }).furusato.maxDonation >
      baseline,
  )
  assert.ok(
    calculateTaxesAndInsurance(500000, 0, { nationalHealthInsuranceAmount: 300000 }).furusato
      .maxDonation < baseline,
  )
  const business = calculateTaxesAndInsurance(0, 0, { businessIncome: 5000000 })
  // No employment-income deduction is allowed against business income.
  close(business.furusato.maxDonation, Math.floor(((457000 - 2500) * 0.2) / 0.6958 + 2000))
})

test('iDeCo, medical, insurance and family deductions reduce the ceiling', () => {
  const baseline = calculateTaxesAndInsurance(500000, 0).furusato.maxDonation
  for (const [type, value] of [
    ['ideco', 23000],
    ['medical_expense', 500000],
    ['life_insurance', 80000],
    ['earthquake_insurance', 50000],
    ['dependent_general', 1],
    ['dependent_specified', 1],
  ] as const) {
    const additionalDeductions = calculateDeductionAmount(type, value, 4360000)
    const residentAdditionalDeductions = calculateResidentDeductionAmount(type, value, 4360000)
    assert.ok(
      calculateTaxesAndInsurance(500000, 0, {
        additionalDeductions,
        residentAdditionalDeductions,
        personalDeductionDifference: type.startsWith('dependent')
          ? additionalDeductions - residentAdditionalDeductions
          : 0,
      }).furusato.maxDonation < baseline,
      type,
    )
  }
  assert.equal(calculateResidentDeductionAmount('dependent_specified', 1, 4360000), 450000)
  assert.equal(calculateResidentDeductionAmount('life_insurance', 80000, 4360000), 28000)
  assert.equal(calculateDeductionAmount('medical_expense', 200000, 1000000), 150000)
  assert.equal(calculateDeductionAmount('medical_expense', 200000, 5000000), 100000)
})

test('applied tax-return deduction changes taxable income and enforces the special cap', () => {
  const baseline = calculateTaxesAndInsurance(500000, 0)
  const donated = calculateTaxesAndInsurance(500000, 0, { furusatoNetDonation: 498000 })
  assert.equal(donated.taxableIncome, baseline.taxableIncome - 498000)
  assert.equal(donated.furusatoIncomeTaxCredit, baseline.incomeTax - donated.incomeTax)
  assert.ok(donated.furusatoIncomeTaxCredit + donated.furusatoResidentTaxCredit < 498000)
  assert.ok(donated.residentTax >= 5000)
})

test('full donation inputs preserve small personal costs and never offset flat taxes', () => {
  for (const amount of [0, 1000, 2000]) {
    const result = calculateTaxesAndInsurance(300000, 0, { furusatoDonation: amount })
    assert.equal(result.furusato.outOfPocket, amount)
    assert.equal(result.furusatoIncomeTaxCredit, 0)
    assert.equal(result.furusatoResidentTaxCredit, 0)
  }
  const noIncomeTax = calculateTaxesAndInsurance(0, 0, {
    businessIncome: 600001,
    furusatoDonation: 1000000,
    homeLoanCredit: 500000,
  })
  assert.ok(noIncomeTax.residentTax >= 5000)
})

test('a higher actual rate can still recover a donation after the special credit reaches its cap', () => {
  const higherActualRate = { ...input, residentTaxableIncome: 3400000 }
  // Actual taxable income remains ¥3.56m (20%); deemed base is ¥3.2m (10%).
  const result = calculateFurusato(higherActualRate)
  assert.equal(result.maxDonation, Math.floor(74700 / 0.6958 + 2000))
  assert.ok(result.maxDonation > Math.floor(74700 / 0.7979 + 2000))
  const benefit = calculateDonationTaxBenefit(higherActualRate, result.maxDonation)
  close(benefit.residentSpecialCredit, 74700)
  assert.ok(benefit.totalTaxSaving >= result.maxDonation - 2000)
})
