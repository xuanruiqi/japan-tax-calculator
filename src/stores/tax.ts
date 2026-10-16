import { ref, computed, watch } from 'vue'
import { defineStore } from 'pinia'
import {
  calculateTaxesAndInsurance,
  calculateEmployeeChildSupportContribution,
  getStandardRemunerationGrade,
  type TaxCalculationOptions,
} from '../utils/taxCalculation'
import {
  computeNhiIncomes,
  calculateNhiChildSupportContribution,
  calculateMunicipalityNhi,
  isMunicipalitySupported,
  type NhiBreakdown,
} from '../utils/nhiCalculation'
import { calculateNationalPension, type PensionResult } from '../utils/kokunenCalculation'
import { KYOKAI_KENPO_RATES, RESIDENT_TAX_RATES } from '../data/taxRates'
import {
  type DeductionEntry,
  type DeductionType,
  DEDUCTION_DEFS,
  DEDUCTION_ORDER,
  calculateDeductionAmount,
  getCashCost,
  IDECO_MONTHLY_LIMITS,
} from '../data/deductions'
import { calculateHomeLoanCredit, type HomeLoanParams } from '../data/homeLoan'

// --- Exported types ---
export type IncomeType = 'salary' | 'business'
export type KenpoType = 'kyokai' | 'its' | 'tjk' | 'other'
export type AgeGroupType = 'under40' | '40to64' | '65over'
export type NhiMode = 'manual' | 'auto' | 'municipality'
export type IndustryType = 'general' | 'agriForestry' | 'construction'

export interface IncomeEntry {
  id: string
  type: IncomeType
  name: string
  monthlySalary: number | null
  annualBonus: number | null
  revenue: number | null
  expenses: number | null
  joinsSocialInsurance: boolean
  joinsEmploymentInsurance: boolean
}

export interface DependentEntry {
  id: string
  age: number | null
}

interface SavedState {
  currentLocale: string
  currentTheme?: 'light' | 'dark'
  enrolledEmployeeSI: boolean
  hasSpouseOrDependents: boolean
  hasSpouse: boolean
  spouseAnnualIncome: number | null
  spouseAge: number | null
  dependents: DependentEntry[]
  nhiMode: NhiMode
  nhiManualAmount: number | null
  nhiKintowari: number | null
  nhiShotokuwariRate: number | null
  nhiChildSupportRate: number | null
  incomeEntries: IncomeEntry[]
  previousYearIncomeInput: number | null | ''
  employmentPrefecture: string
  residencePrefecture: string
  residenceCity: string
  selectedKenpo: KenpoType
  ageGroup: AgeGroupType
  showAdvancedOptions: boolean
  customHealthRate: number | null
  customKaigoRate: number | null
  customPensionRate: number | null
  customEmploymentInsRate: number | null
  selectedIndustry: IndustryType
  deductionEntries: DeductionEntry[]
}

const STORAGE_KEY = 'tax-calculator-state'

export const useTaxStore = defineStore('tax', () => {
  // --- State ---
  const incomeEntries = ref<IncomeEntry[]>([
    {
      id: 'salary-default',
      type: 'salary',
      name: '',
      monthlySalary: 300000,
      annualBonus: 0,
      revenue: null,
      expenses: null,
      joinsSocialInsurance: true,
      joinsEmploymentInsurance: true,
    },
  ])
  const previousYearIncomeInput = ref<number | null | ''>(null)

  const employmentPrefecture = ref<string>('tokyo')
  const residencePrefecture = ref<string>('tokyo')
  const residenceCity = ref<string>('standard')

  const enrolledEmployeeSI = ref<boolean>(true)
  const ageGroup = ref<AgeGroupType>('under40')
  const hasSpouseOrDependents = ref<boolean>(false)
  const hasSpouse = ref<boolean>(false)
  const spouseAnnualIncome = ref<number | null>(null)
  const spouseAge = ref<number | null>(null)
  const dependents = ref<DependentEntry[]>([])

  const nhiMode = ref<NhiMode>('manual')
  const nhiManualAmount = ref<number | null>(null)
  const nhiKintowari = ref<number | null>(null)
  const nhiShotokuwariRate = ref<number | null>(null)
  const nhiChildSupportRate = ref<number | null>(null)

  const selectedKenpo = ref<KenpoType>('kyokai')
  const showAdvancedOptions = ref<boolean>(false)
  const customHealthRate = ref<number | null>(4.99)
  const customKaigoRate = ref<number | null>(0)
  const customPensionRate = ref<number | null>(9.15)
  const customEmploymentInsRate = ref<number | null>(0.6)
  const selectedIndustry = ref<IndustryType>('general')

  const deductionEntries = ref<DeductionEntry[]>([])

  // --- Internal helpers ---
  function getNhiIncomes(): { salaryGross: number; bizIncome: number } {
    const prevRaw = previousYearIncomeInput.value
    if (prevRaw !== null && prevRaw !== '' && Number(prevRaw) >= 0) {
      return { salaryGross: Number(prevRaw), bizIncome: 0 }
    }
    const salaryGross = incomeEntries.value
      .filter((e) => e.type === 'salary')
      .reduce(
        (sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0),
        0,
      )
    const bizIncome = incomeEntries.value
      .filter((e) => e.type === 'business')
      .reduce(
        (sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)),
        0,
      )
    return { salaryGross, bizIncome }
  }

  function updateKaigoRate() {
    if (ageGroup.value !== '40to64') {
      customKaigoRate.value = 0
      return
    }
    if (selectedKenpo.value === 'kyokai') {
      customKaigoRate.value = 0.8 // 1.60% / 2
    } else if (selectedKenpo.value === 'its' || selectedKenpo.value === 'tjk') {
      customKaigoRate.value = 0.9 // 1.80% / 2
    } else if (selectedKenpo.value === 'other' && customKaigoRate.value === 0) {
      customKaigoRate.value = 0.8
    }
  }

  // --- Getters ---
  const primarySalaryEntry = computed(() => incomeEntries.value.find((e) => e.type === 'salary'))
  const hasSalaryIncome = computed(() => !!primarySalaryEntry.value)
  const monthlySalaryInput = computed(() => primarySalaryEntry.value?.monthlySalary ?? 0)
  const annualBonusInput = computed(() => primarySalaryEntry.value?.annualBonus ?? 0)

  const availableCities = computed(() => {
    const pref = RESIDENT_TAX_RATES[residencePrefecture.value]
    if (!pref) return []
    return Object.keys(pref.cities)
  })

  const idecoMonthlyLimit = computed(() =>
    incomeEntries.value.some((e) => e.type === 'salary' && e.joinsSocialInsurance)
      ? IDECO_MONTHLY_LIMITS.employee
      : IDECO_MONTHLY_LIMITS.selfEmployed,
  )

  const availableDeductionTypes = computed(() => {
    const used = new Set(deductionEntries.value.map((d) => d.type))
    const singletons: DeductionType[] = [
      'life_insurance',
      'earthquake_insurance',
      'medical_expense',
      'furusato',
      'ideco',
      'home_loan',
    ]
    return DEDUCTION_ORDER.filter((type) => {
      if (type === 'spouse') return false
      if (
        type === 'dependent_general' ||
        type === 'dependent_specified' ||
        type === 'dependent_aged'
      )
        return false
      if (singletons.includes(type)) return !used.has(type)
      return true
    })
  })

  const autoSpouseDeduction = computed(() => {
    if (!hasSpouse.value) return 0
    const income = spouseAnnualIncome.value ?? 0
    if (income <= 480000) return (spouseAge.value ?? 0) >= 70 ? 480000 : 380000
    return calculateDeductionAmount('spouse', income, 0)
  })

  const autoDependentDeductions = computed(() => {
    let general = 0,
      specified = 0,
      aged = 0
    for (const dep of dependents.value) {
      const age = dep.age ?? -1
      if (age < 16) continue
      if (age >= 70) aged++
      else if (age >= 19 && age <= 22) specified++
      else general++
    }
    return {
      general,
      specified,
      aged,
      generalAmount: general * 380000,
      specifiedAmount: specified * 630000,
      agedAmount: aged * 480000,
      total: general * 380000 + specified * 630000 + aged * 480000,
    }
  })

  const totalAdditionalDeductions = computed(() => {
    const salaryGross = incomeEntries.value
      .filter((e) => e.type === 'salary')
      .reduce(
        (sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0),
        0,
      )
    const bizIncome = incomeEntries.value
      .filter((e) => e.type === 'business')
      .reduce(
        (sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)),
        0,
      )
    const gross = salaryGross + bizIncome
    const autoTypes = new Set<DeductionType>([
      'spouse',
      'dependent_general',
      'dependent_specified',
      'dependent_aged',
    ])
    return (
      deductionEntries.value
        .filter((e) => !DEDUCTION_DEFS[e.type].isTaxCredit && !autoTypes.has(e.type))
        .reduce(
          (sum, entry) =>
            sum + calculateDeductionAmount(entry.type, entry.value, gross, idecoMonthlyLimit.value),
          0,
        ) +
      autoSpouseDeduction.value +
      autoDependentDeductions.value.total
    )
  })

  const furusatoNetDonation = computed(() => {
    const furusato = deductionEntries.value.find((e) => e.type === 'furusato')
    if (!furusato || !furusato.value) return 0
    return Math.max(0, furusato.value - 2000)
  })

  const homeLoanCreditAmount = computed(() => {
    const entry = deductionEntries.value.find((e) => e.type === 'home_loan')
    if (!entry?.homeLoanParams) return 0
    return calculateHomeLoanCredit(entry.homeLoanParams)
  })

  const municipalityAutoAvailable = computed(() => isMunicipalitySupported(residenceCity.value))

  const pensionResult = computed((): PensionResult => {
    if (enrolledEmployeeSI.value)
      return { monthlyPremium: 0, annualPremium: 0, exemptionTier: 'none' }
    const { salaryGross, bizIncome } = getNhiIncomes()
    const { totalIncome } = computeNhiIncomes(salaryGross, bizIncome)
    return calculateNationalPension(totalIncome)
  })

  const municipalityNhiBreakdown = computed((): NhiBreakdown | null => {
    const { salaryGross, bizIncome } = getNhiIncomes()
    const { totalIncome, base } = computeNhiIncomes(salaryGross, bizIncome)
    return calculateMunicipalityNhi(residenceCity.value, totalIncome, base, ageGroup.value)
  })

  const nhiAmount = computed(() => {
    if (enrolledEmployeeSI.value) return 0
    if (nhiMode.value === 'manual') {
      return Math.max(0, Number(nhiManualAmount.value) || 0)
    }
    if (nhiMode.value === 'municipality') {
      return municipalityNhiBreakdown.value?.total ?? 0
    }
    // Auto mode: 所得割 + 均等割
    const { salaryGross, bizIncome } = getNhiIncomes()
    const { base } = computeNhiIncomes(salaryGross, bizIncome)
    const shotokuwari = Math.floor((base * (Number(nhiShotokuwariRate.value) || 0)) / 100)
    const kintowari = Number(nhiKintowari.value) || 0
    return (
      shotokuwari +
      kintowari +
      calculateNhiChildSupportContribution(base, Number(nhiChildSupportRate.value) || 0)
    )
  })

  const totalCashCost = computed(() =>
    deductionEntries.value.reduce((sum, e) => sum + getCashCost(e, idecoMonthlyLimit.value), 0),
  )

  const cashCostEntries = computed(() =>
    deductionEntries.value.filter((e) => getCashCost(e, idecoMonthlyLimit.value) > 0),
  )

  const taxCalculationInput = computed(
    (): { salary: number; bonus: number; options: TaxCalculationOptions } => {
      const salary = Number(monthlySalaryInput.value) || 0
      const bonus = Number(annualBonusInput.value) || 0

      const prevIncomeRaw = previousYearIncomeInput.value
      const prevIncome =
        prevIncomeRaw == null || prevIncomeRaw === '' ? null : Number(prevIncomeRaw)
      const hRate = customHealthRate.value !== null ? Number(customHealthRate.value) / 100 : 0.0499
      const kRate = customKaigoRate.value !== null ? Number(customKaigoRate.value) / 100 : 0
      const pRate =
        customPensionRate.value !== null ? Number(customPensionRate.value) / 100 : 0.0915
      const eRate =
        customEmploymentInsRate.value !== null ? Number(customEmploymentInsRate.value) / 100 : 0.006

      const nonPrimaryEntries = incomeEntries.value.filter(
        (e) => e.type === 'salary' && e !== primarySalaryEntry.value,
      )
      const additionalSalaryGross = nonPrimaryEntries.reduce(
        (sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0),
        0,
      )

      let additionalHealthInsurance = 0
      let additionalKaigoInsurance = 0
      let additionalChildSupportContribution = 0
      let additionalPension = 0
      for (const entry of nonPrimaryEntries) {
        const ms = Number(entry.monthlySalary) || 0
        const ab = Number(entry.annualBonus) || 0
        if (entry.joinsSocialInsurance) {
          additionalChildSupportContribution += calculateEmployeeChildSupportContribution(
            ms,
            ab,
          ).annual
          const hObj = getStandardRemunerationGrade(ms, 1390000)
          const pObj = getStandardRemunerationGrade(ms, 650000)
          const bonusStdH = Math.min(Math.floor(ab / 1000) * 1000, 5730000)
          const bonusStdP = Math.min(Math.floor(ab / 1000) * 1000, 1500000)
          additionalHealthInsurance +=
            Math.floor(hObj.value * hRate) * 12 + Math.floor(bonusStdH * hRate)
          additionalKaigoInsurance +=
            Math.floor(hObj.value * kRate) * 12 + Math.floor(bonusStdH * kRate)
          additionalPension += Math.floor(pObj.value * pRate) * 12 + Math.floor(bonusStdP * pRate)
        }
      }

      const totalBusinessIncome = incomeEntries.value
        .filter((e) => e.type === 'business')
        .reduce(
          (sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)),
          0,
        )

      const prefData = RESIDENT_TAX_RATES[residencePrefecture.value]
      let localTaxRates = prefData
        ? prefData.default
        : { prefIncomeRate: 0.04, cityIncomeRate: 0.06, prefPerCapita: 1500, cityPerCapita: 3500 }

      if (prefData && residenceCity.value !== 'standard') {
        const cityOverrides = prefData.cities[residenceCity.value]
        if (cityOverrides) {
          localTaxRates = cityOverrides
        }
      }

      const globalSI = enrolledEmployeeSI.value

      return {
        salary,
        bonus,
        options: {
          previousYearGross: prevIncome,
          healthInsuranceRate: globalSI ? hRate : 0,
          kaigoInsuranceRate: globalSI ? kRate : 0,
          childSupportRate: globalSI ? undefined : 0,
          pensionRate: globalSI ? pRate : 0,
          nationalPensionAmount: globalSI ? 0 : pensionResult.value.annualPremium,
          nationalHealthInsuranceAmount: globalSI ? 0 : nhiAmount.value,
          employmentInsuranceRate:
            primarySalaryEntry.value?.joinsEmploymentInsurance !== false ? eRate : 0,
          primaryJoinsSocialInsurance: primarySalaryEntry.value?.joinsSocialInsurance !== false,
          additionalSalaryGross,
          additionalHealthInsurance: globalSI ? additionalHealthInsurance : 0,
          additionalChildSupportContribution: globalSI ? additionalChildSupportContribution : 0,
          additionalKaigoInsurance: globalSI ? additionalKaigoInsurance : 0,
          additionalPension: globalSI ? additionalPension : 0,
          businessIncome: totalBusinessIncome,
          prefIncomeRate: localTaxRates.prefIncomeRate,
          cityIncomeRate: localTaxRates.cityIncomeRate,
          prefPerCapita: localTaxRates.prefPerCapita,
          cityPerCapita: localTaxRates.cityPerCapita,
          additionalDeductions: totalAdditionalDeductions.value,
          furusatoNetDonation: furusatoNetDonation.value,
          homeLoanCredit: homeLoanCreditAmount.value,
        },
      }
    },
  )

  const results = computed(() => {
    const { salary, bonus, options } = taxCalculationInput.value
    return calculateTaxesAndInsurance(salary, bonus, options)
  })

  const hasIdecoDeduction = computed(() => deductionEntries.value.some((e) => e.type === 'ideco'))

  const resultsWithMaxIdeco = computed(() => {
    if (hasIdecoDeduction.value) return null
    const { salary, bonus, options } = taxCalculationInput.value
    const maxIdecoAnnual = idecoMonthlyLimit.value * 12
    return calculateTaxesAndInsurance(salary, bonus, {
      ...options,
      additionalDeductions: (options.additionalDeductions ?? 0) + maxIdecoAnnual,
    })
  })

  // --- Internal watches ---
  watch(enrolledEmployeeSI, (newVal) => {
    const entries = incomeEntries.value
    const sole = entries.length === 1 ? entries[0] : undefined
    if (!newVal && sole?.type === 'salary') {
      const annualGross = (Number(sole.monthlySalary) || 0) * 12 + (Number(sole.annualBonus) || 0)
      incomeEntries.value = [
        {
          id: sole.id,
          type: 'business',
          name: sole.name,
          monthlySalary: null,
          annualBonus: null,
          revenue: annualGross,
          expenses: 0,
          joinsSocialInsurance: false,
          joinsEmploymentInsurance: false,
        },
      ]
    } else if (newVal && sole?.type === 'business') {
      const monthly = Math.round((Number(sole.revenue) || 0) / 12)
      incomeEntries.value = [
        {
          id: sole.id,
          type: 'salary',
          name: sole.name,
          monthlySalary: monthly,
          annualBonus: 0,
          revenue: null,
          expenses: null,
          joinsSocialInsurance: true,
          joinsEmploymentInsurance: true,
        },
      ]
    }
  })

  watch(employmentPrefecture, (newPref) => {
    if (selectedKenpo.value === 'kyokai') {
      customHealthRate.value = KYOKAI_KENPO_RATES[newPref] || 4.99
    }
  })

  watch(ageGroup, () => {
    updateKaigoRate()
  })

  watch(municipalityAutoAvailable, (available) => {
    if (!available && nhiMode.value === 'municipality') nhiMode.value = 'manual'
  })

  // --- Actions ---
  function addIncomeEntry(type: IncomeType) {
    incomeEntries.value.push({
      id: `${type}-${Date.now()}`,
      type,
      name: '',
      monthlySalary: type === 'salary' ? 0 : null,
      annualBonus: type === 'salary' ? 0 : null,
      revenue: type === 'business' ? 0 : null,
      expenses: type === 'business' ? 0 : null,
      joinsSocialInsurance: false,
      joinsEmploymentInsurance: type === 'salary',
    })
  }

  function removeIncomeEntry(id: string) {
    incomeEntries.value = incomeEntries.value.filter((e) => e.id !== id)
  }

  function addDependent() {
    dependents.value.push({ id: `dep-${Date.now()}`, age: null })
  }

  function removeDependent(id: string) {
    dependents.value = dependents.value.filter((d) => d.id !== id)
  }

  function pushDeductionEntry(type: DeductionType) {
    deductionEntries.value.push({
      id: `${type}-${Date.now()}`,
      type,
      value: DEDUCTION_DEFS[type].inputIsCount ? 1 : 0,
    })
  }

  function removeDeduction(id: string) {
    deductionEntries.value = deductionEntries.value.filter((d) => d.id !== id)
  }

  function deductionAmountFor(entry: DeductionEntry): number {
    const salaryGross = incomeEntries.value
      .filter((e) => e.type === 'salary')
      .reduce(
        (sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0),
        0,
      )
    const bizIncome = incomeEntries.value
      .filter((e) => e.type === 'business')
      .reduce(
        (sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)),
        0,
      )
    return calculateDeductionAmount(
      entry.type,
      entry.value,
      salaryGross + bizIncome,
      idecoMonthlyLimit.value,
    )
  }

  function confirmHomeLoan(params: HomeLoanParams, editingId: string | null) {
    const credit = calculateHomeLoanCredit(params)
    if (editingId) {
      const entry = deductionEntries.value.find((e) => e.id === editingId)
      if (entry) {
        entry.homeLoanParams = params
        entry.value = credit
      }
    } else {
      deductionEntries.value.push({
        id: `home_loan-${Date.now()}`,
        type: 'home_loan',
        value: credit,
        homeLoanParams: params,
      })
    }
  }

  function onResidencePrefectureChange() {
    residenceCity.value = 'standard'
  }

  function onKenpoChange() {
    if (selectedKenpo.value === 'kyokai') {
      customHealthRate.value = KYOKAI_KENPO_RATES[employmentPrefecture.value] || 4.99
    } else if (selectedKenpo.value === 'its') {
      customHealthRate.value = 4.75
    } else if (selectedKenpo.value === 'tjk') {
      customHealthRate.value = 4.45
    } else if (selectedKenpo.value === 'other') {
      showAdvancedOptions.value = true
    }
    updateKaigoRate()
  }

  function onIndustryChange() {
    if (selectedIndustry.value === 'general') {
      customEmploymentInsRate.value = 0.6
    } else {
      customEmploymentInsRate.value = 0.7
    }
  }

  // --- Persistence ---
  function save(localeValue: string, themeValue: 'light' | 'dark') {
    const state: SavedState = {
      currentLocale: localeValue,
      currentTheme: themeValue,
      enrolledEmployeeSI: enrolledEmployeeSI.value,
      hasSpouseOrDependents: hasSpouseOrDependents.value,
      hasSpouse: hasSpouse.value,
      spouseAnnualIncome: spouseAnnualIncome.value,
      spouseAge: spouseAge.value,
      dependents: dependents.value,
      nhiMode: nhiMode.value,
      nhiManualAmount: nhiManualAmount.value,
      nhiKintowari: nhiKintowari.value,
      nhiShotokuwariRate: nhiShotokuwariRate.value,
      nhiChildSupportRate: nhiChildSupportRate.value,
      incomeEntries: incomeEntries.value,
      previousYearIncomeInput: previousYearIncomeInput.value,
      employmentPrefecture: employmentPrefecture.value,
      residencePrefecture: residencePrefecture.value,
      residenceCity: residenceCity.value,
      selectedKenpo: selectedKenpo.value,
      ageGroup: ageGroup.value,
      showAdvancedOptions: showAdvancedOptions.value,
      customHealthRate: customHealthRate.value,
      customKaigoRate: customKaigoRate.value,
      customPensionRate: customPensionRate.value,
      customEmploymentInsRate: customEmploymentInsRate.value,
      selectedIndustry: selectedIndustry.value,
      deductionEntries: deductionEntries.value,
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {}
  }

  function load(): { locale: string | null; theme: 'light' | 'dark' | null } {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return { locale: null, theme: null }
      const s: Partial<SavedState> = JSON.parse(raw)
      if (s.enrolledEmployeeSI != null) enrolledEmployeeSI.value = s.enrolledEmployeeSI
      if (s.hasSpouseOrDependents != null) hasSpouseOrDependents.value = s.hasSpouseOrDependents
      if (s.hasSpouse != null) hasSpouse.value = s.hasSpouse
      if (s.spouseAnnualIncome !== undefined) spouseAnnualIncome.value = s.spouseAnnualIncome
      if (s.spouseAge !== undefined) spouseAge.value = s.spouseAge
      if (s.dependents != null) dependents.value = s.dependents
      if (s.nhiMode != null) nhiMode.value = s.nhiMode
      if (s.nhiManualAmount !== undefined) nhiManualAmount.value = s.nhiManualAmount
      if (s.nhiKintowari !== undefined) nhiKintowari.value = s.nhiKintowari
      if (s.nhiShotokuwariRate !== undefined) nhiShotokuwariRate.value = s.nhiShotokuwariRate
      if (s.nhiChildSupportRate !== undefined) nhiChildSupportRate.value = s.nhiChildSupportRate
      if (s.incomeEntries != null) incomeEntries.value = s.incomeEntries
      if (s.previousYearIncomeInput !== undefined)
        previousYearIncomeInput.value = s.previousYearIncomeInput
      if (s.employmentPrefecture != null) employmentPrefecture.value = s.employmentPrefecture
      if (s.residencePrefecture != null) residencePrefecture.value = s.residencePrefecture
      if (s.residenceCity != null) residenceCity.value = s.residenceCity
      if (s.selectedKenpo != null) selectedKenpo.value = s.selectedKenpo
      if (s.ageGroup != null) ageGroup.value = s.ageGroup
      if (s.showAdvancedOptions != null) showAdvancedOptions.value = s.showAdvancedOptions
      if (s.customHealthRate !== undefined) customHealthRate.value = s.customHealthRate
      if (s.customKaigoRate !== undefined) customKaigoRate.value = s.customKaigoRate
      if (s.customPensionRate !== undefined) customPensionRate.value = s.customPensionRate
      if (s.customEmploymentInsRate !== undefined)
        customEmploymentInsRate.value = s.customEmploymentInsRate
      if (s.selectedIndustry != null) selectedIndustry.value = s.selectedIndustry
      if (s.deductionEntries != null) deductionEntries.value = s.deductionEntries
      return {
        locale: s.currentLocale ?? null,
        theme: s.currentTheme === 'dark' ? 'dark' : s.currentTheme === 'light' ? 'light' : null,
      }
    } catch {
      return { locale: null, theme: null }
    }
  }

  function reset() {
    enrolledEmployeeSI.value = true
    hasSpouseOrDependents.value = false
    hasSpouse.value = false
    spouseAnnualIncome.value = null
    spouseAge.value = null
    dependents.value = []
    nhiMode.value = 'manual'
    nhiManualAmount.value = null
    nhiKintowari.value = null
    nhiShotokuwariRate.value = null
    nhiChildSupportRate.value = null
    incomeEntries.value = [
      {
        id: 'salary-default',
        type: 'salary',
        name: '',
        monthlySalary: 300000,
        annualBonus: 0,
        revenue: null,
        expenses: null,
        joinsSocialInsurance: true,
        joinsEmploymentInsurance: true,
      },
    ]
    previousYearIncomeInput.value = null
    employmentPrefecture.value = 'tokyo'
    residencePrefecture.value = 'tokyo'
    residenceCity.value = 'standard'
    selectedKenpo.value = 'kyokai'
    ageGroup.value = 'under40'
    showAdvancedOptions.value = false
    customHealthRate.value = 4.99
    customKaigoRate.value = 0
    customPensionRate.value = 9.15
    customEmploymentInsRate.value = 0.6
    selectedIndustry.value = 'general'
    deductionEntries.value = []
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {}
  }

  return {
    // State
    incomeEntries,
    previousYearIncomeInput,
    employmentPrefecture,
    residencePrefecture,
    residenceCity,
    enrolledEmployeeSI,
    ageGroup,
    hasSpouseOrDependents,
    hasSpouse,
    spouseAnnualIncome,
    spouseAge,
    dependents,
    nhiMode,
    nhiManualAmount,
    nhiKintowari,
    nhiShotokuwariRate,
    nhiChildSupportRate,
    selectedKenpo,
    showAdvancedOptions,
    customHealthRate,
    customKaigoRate,
    customPensionRate,
    customEmploymentInsRate,
    selectedIndustry,
    deductionEntries,
    // Getters
    primarySalaryEntry,
    hasSalaryIncome,
    monthlySalaryInput,
    annualBonusInput,
    availableCities,
    idecoMonthlyLimit,
    availableDeductionTypes,
    autoSpouseDeduction,
    autoDependentDeductions,
    totalAdditionalDeductions,
    furusatoNetDonation,
    homeLoanCreditAmount,
    municipalityAutoAvailable,
    pensionResult,
    municipalityNhiBreakdown,
    nhiAmount,
    totalCashCost,
    cashCostEntries,
    results,
    hasIdecoDeduction,
    resultsWithMaxIdeco,
    // Actions
    addIncomeEntry,
    removeIncomeEntry,
    addDependent,
    removeDependent,
    pushDeductionEntry,
    removeDeduction,
    deductionAmountFor,
    confirmHomeLoan,
    onResidencePrefectureChange,
    onKenpoChange,
    onIndustryChange,
    save,
    load,
    reset,
  }
})
