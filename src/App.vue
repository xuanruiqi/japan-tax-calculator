<script setup lang="ts">
import { ref, computed, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import type { MessageSchema } from './locales'
import { getStandardRemunerationGrade } from './utils/taxCalculation'
import { PREFECTURES_LIST, PREFECTURE_NAMES, CITY_NAMES } from './data/taxRates'
import { DEDUCTION_DEFS, getCashCost } from './data/deductions'
import { type HomeLoanParams } from './data/homeLoan'
import DonutChart, { type PieSlice } from './components/DonutChart.vue'
import HomeLoanWizard from './components/HomeLoanWizard.vue'
import IncomeSection from './components/IncomeSection.vue'
import DeductionSection from './components/DeductionSection.vue'
import YenInputNumber from './components/YenInputNumber.vue'
import { useTaxStore } from './stores/tax'

const { t, locale: _locale } = useI18n<{ message: MessageSchema }>()
// Wrap in a typed computed so comparisons against 'en' | 'ja' are type-safe
const locale = computed({
  get: () => _locale.value as 'en' | 'ja',
  set: (v: 'en' | 'ja') => {
    ;(_locale as unknown as { value: 'en' | 'ja' }).value = v
  },
})

watchEffect(() => {
  document.title = t('title')
})

const store = useTaxStore()
const {
  incomeEntries,
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
  primarySalaryEntry,
  hasSalaryIncome,
  availableCities,
  idecoMonthlyLimit,
  autoSpouseDeduction,
  autoDependentDeductions,
  municipalityAutoAvailable,
  pensionResult,
  municipalityNhiBreakdown,
  municipalityChildSupportRates,
  nhiChildSupportAmount,
  totalCashCost,
  cashCostEntries,
  results,
  hasIdecoDeduction,
  resultsWithMaxIdeco,
} = storeToRefs(store)

const { addDependent, removeDependent, deductionAmountFor } = store

// --- UI-only state ---
const showHomeLoanWizard = ref(false)
const editingHomeLoanId = ref<string | null>(null)
const theme = ref<'light' | 'dark'>('light')

watchEffect(() => {
  const isDark = theme.value === 'dark'
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.dataset.theme = theme.value
  document.body.classList.toggle('dark-mode', isDark)

  document.documentElement.style.backgroundColor = isDark ? '#020617' : '#f7f9fc'
  document.body.style.backgroundColor = isDark ? '#020617' : '#f7f9fc'

  const appRoot = document.getElementById('app')
  if (appRoot) {
    appRoot.style.backgroundColor = isDark ? '#020617' : '#f7f9fc'
  }
})

// --- i18n-dependent computeds ---
const prefName = (id: string) => PREFECTURE_NAMES[id]?.[locale.value] ?? id
const cityName = (id: string) => CITY_NAMES[id]?.[locale.value] ?? id

const prefectureItems = computed(() =>
  PREFECTURES_LIST.map((pref) => ({ label: prefName(pref), value: pref })),
)
const cityItems = computed(() => [
  { label: t('standardCity'), value: 'standard' },
  ...availableCities.value.map((city) => ({ label: cityName(city), value: city })),
])
const ageGroupItems = computed(() => [
  { label: t('ageUnder40'), value: 'under40' as const },
  { label: t('age40to64'), value: '40to64' as const },
  { label: t('age65over'), value: '65over' as const },
])
const kenpoItems = computed(() => [
  { label: t('unionKyokai'), value: 'kyokai' as const },
  { label: t('unionIts'), value: 'its' as const },
  { label: t('unionTjk'), value: 'tjk' as const },
  { label: t('unionOther'), value: 'other' as const },
])
const industryItems = computed(() => [
  { label: t('industryGeneral'), value: 'general' as const },
  { label: t('industryAgriForestry'), value: 'agriForestry' as const },
  { label: t('industryConstruction'), value: 'construction' as const },
])
// --- Event handler aliases (template uses these names) ---
const handleResidencePrefectureChange = () => store.onResidencePrefectureChange()
const handleKenpoChange = () => store.onKenpoChange()
const handleIndustryChange = () => store.onIndustryChange()

// --- Local action wrappers ---
const handleHomeLoanConfirm = (params: HomeLoanParams) => {
  store.confirmHomeLoan(params, editingHomeLoanId.value)
  showHomeLoanWizard.value = false
  editingHomeLoanId.value = null
}

const openHomeLoanEdit = (id: string) => {
  editingHomeLoanId.value = id
  showHomeLoanWizard.value = true
}

const openHomeLoanWizard = () => {
  editingHomeLoanId.value = null
  showHomeLoanWizard.value = true
}

const closeHomeLoanWizard = () => {
  showHomeLoanWizard.value = false
  editingHomeLoanId.value = null
}

const toggleTheme = () => {
  theme.value = theme.value === 'light' ? 'dark' : 'light'
}

const resetState = () => {
  store.reset()
  locale.value = 'ja'
  theme.value = 'light'
}

// --- Persistence ---
const savedPreferences = store.load()
if (savedPreferences.locale === 'en' || savedPreferences.locale === 'ja') {
  locale.value = savedPreferences.locale
}
if (savedPreferences.theme === 'light' || savedPreferences.theme === 'dark') {
  theme.value = savedPreferences.theme
}

watch(
  () => store.$state,
  () => store.save(locale.value, theme.value),
  { deep: true },
)
watch([locale, theme], () => store.save(locale.value, theme.value))

interface SiBreakdownEntry {
  entryId: string
  label: string
  healthBracket: number
  pensionBracket: number
  healthStandardRemuneration: number
  pensionStandardRemuneration: number
  annualHealth: number
  annualKaigo: number
  annualPension: number
}

const siBreakdown = computed((): SiBreakdownEntry[] => {
  const globalSI = enrolledEmployeeSI.value
  if (!globalSI) return []
  const hRate = globalSI
    ? customHealthRate.value !== null
      ? Number(customHealthRate.value) / 100
      : 0.0499
    : 0
  const kRate = globalSI
    ? customKaigoRate.value !== null
      ? Number(customKaigoRate.value) / 100
      : 0
    : 0
  const pRate = globalSI
    ? customPensionRate.value !== null
      ? Number(customPensionRate.value) / 100
      : 0.0915
    : 0
  const entries: SiBreakdownEntry[] = []
  let salaryIndex = 0

  for (const entry of incomeEntries.value) {
    if (entry.type !== 'salary' || !entry.joinsSocialInsurance) continue
    salaryIndex++
    const ms = Number(entry.monthlySalary) || 0
    const ab = Number(entry.annualBonus) || 0
    const hObj = getStandardRemunerationGrade(ms, 1390000)
    const pObj = getStandardRemunerationGrade(ms, 650000)
    const pBracket = pObj.grade > 0 ? Math.max(1, pObj.grade - 3) : 0
    const bonusStdH = Math.min(Math.floor(ab / 1000) * 1000, 5730000)
    const bonusStdP = Math.min(Math.floor(ab / 1000) * 1000, 1500000)
    const annualHealth = Math.floor(hObj.value * hRate) * 12 + Math.floor(bonusStdH * hRate)
    const annualKaigo = Math.floor(hObj.value * kRate) * 12 + Math.floor(bonusStdH * kRate)
    const annualPension = Math.floor(pObj.value * pRate) * 12 + Math.floor(bonusStdP * pRate)
    const defaultLabel =
      entry === primarySalaryEntry.value
        ? t('primaryJobLabel')
        : t('subJobLabel', { n: salaryIndex })
    const label = entry.name || defaultLabel
    entries.push({
      entryId: entry.id,
      label,
      healthBracket: hObj.grade,
      pensionBracket: pBracket,
      healthStandardRemuneration: hObj.value,
      pensionStandardRemuneration: pObj.value,
      annualHealth,
      annualKaigo,
      annualPension,
    })
  }
  return entries
})

const hasMultipleSiEntries = computed(() => siBreakdown.value.length > 1)

// Format JPY correctly
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value)
}

// iDeCo tax-saving tip
const idecoSavings = computed(() => {
  const withIdeco = resultsWithMaxIdeco.value
  if (!withIdeco) return null
  return {
    incomeTax: results.value.incomeTax - withIdeco.incomeTax,
    residentTax: results.value.residentTax - withIdeco.residentTax,
    total:
      results.value.incomeTax -
      withIdeco.incomeTax +
      (results.value.residentTax - withIdeco.residentTax),
  }
})

// Pie chart slices
const pieSlices = computed((): PieSlice[] => {
  const r = results.value
  const palette =
    theme.value === 'dark'
      ? {
          healthCare: '#5eead4',
          childSupport: '#99f6e4',
          nationalHealth: '#2dd4bf',
          pension: '#60a5fa',
          nationalPension: '#93c5fd',
          employment: '#22d3ee',
          incomeTax: '#fbbf24',
          residentTax: '#c084fc',
          ideco: '#fb923c',
          furusato: '#f472b6',
          takeHome: '#f8fafc',
        }
      : {
          healthCare: '#6fcfad',
          childSupport: '#14b8a6',
          nationalHealth: '#6fcfad',
          pension: '#3b82f6',
          nationalPension: '#60a5fa',
          employment: '#14b8a6',
          incomeTax: '#f59e0b',
          residentTax: '#a78bfa',
          ideco: '#fb923c',
          furusato: '#e879a0',
          takeHome: '#22223b',
        }

  const furusatoEntry = deductionEntries.value.find((e) => e.type === 'furusato')
  const furusatoDonation = furusatoEntry ? getCashCost(furusatoEntry, idecoMonthlyLimit.value) : 0
  const idecoAmount = totalCashCost.value - furusatoDonation

  return [
    {
      label: t('pieHealthCare'),
      value: r.healthInsurance + r.kaigoInsurance,
      color: palette.healthCare,
    },
    {
      label: t('nationalHealthInsurance'),
      value: r.nationalHealthInsurance,
      color: palette.nationalHealth,
    },
    {
      label: t('childSupportContribution'),
      value: r.childSupportContribution,
      color: palette.childSupport,
    },
    { label: t('pension'), value: r.pension, color: palette.pension },
    { label: t('nationalPension'), value: r.nationalPension, color: palette.nationalPension },
    { label: t('employmentIns'), value: r.employmentInsurance, color: palette.employment },
    { label: t('incomeTax'), value: r.incomeTax, color: palette.incomeTax },
    { label: t('residentTax'), value: r.residentTax, color: palette.residentTax },
    { label: t('pieIdeco'), value: idecoAmount, color: palette.ideco },
    { label: t('pieFurusato'), value: furusatoDonation, color: palette.furusato },
    {
      label: t('pieTakeHome'),
      value: Math.max(0, r.netPay - totalCashCost.value),
      color: palette.takeHome,
    },
  ]
})
</script>

<template>
  <UApp>
    <div :class="['app-shell', { 'theme-dark': theme === 'dark' }]">
      <UContainer
        class="app-container py-8 lg:py-0 pb-20"
        :ui="{ base: 'w-full mx-auto px-4 sm:px-6 lg:px-0 lg:max-w-none' }"
      >
        <div class="top-controls fixed top-5 right-6 z-[1000]">
        <UButton
          variant="outline"
          size="sm"
          color="neutral"
          class="theme-toggle rounded-full shadow-sm"
          @click="toggleTheme"
        >
          {{ theme === 'dark' ? t('themeLight') : t('themeDark') }}
        </UButton>

        <UButton
          variant="outline"
          size="sm"
          color="neutral"
          class="lang-toggle rounded-full shadow-sm"
          @click="locale = locale === 'en' ? 'ja' : 'en'"
        >
          {{ locale === 'en' ? '日本語' : 'English' }}
        </UButton>
      </div>

        <UPageGrid :ui="{ base: 'grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-0' }">
        <!-- Input Panel -->
        <div class="panel input-panel">
          <div
            class="input-section location-section"
            style="margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #eaeaea"
          >
            <div class="section-header">
              <h2>{{ t('locationSettings') }}</h2>
              <UButton
                variant="outline"
                size="sm"
                color="error"
                class="reset-btn rounded-full"
                @click="resetState"
                >{{ t('reset') }}</UButton
              >
            </div>

            <div class="si-toggle" style="margin-bottom: 1rem">
              <USwitch v-model="enrolledEmployeeSI" />
              <span>{{ t('enrolledEmployeeSI') }}</span>
            </div>

            <div class="si-toggle" style="margin-bottom: 1rem">
              <USwitch v-model="hasSpouseOrDependents" />
              <span>{{ t('hasSpouseOrDependents') }}</span>
            </div>

            <div class="input-group">
              <label>{{ t('ageGroup') }}</label>
              <USelect v-model="ageGroup" :items="ageGroupItems" class="styled-select" />
            </div>

            <div class="input-group" v-if="enrolledEmployeeSI">
              <label>{{ t('empPrefecture') }}</label>
              <USelect
                v-model="employmentPrefecture"
                :items="prefectureItems"
                class="styled-select"
              />
            </div>

            <div class="input-group">
              <label>{{ t('resPrefecture') }}</label>
              <USelect
                v-model="residencePrefecture"
                :items="prefectureItems"
                class="styled-select"
                @update:model-value="handleResidencePrefectureChange"
              />
            </div>

            <div class="input-group" v-if="availableCities.length > 0">
              <label>{{ t('municipality') }}</label>
              <USelect v-model="residenceCity" :items="cityItems" class="styled-select" />
            </div>

            <div v-if="!enrolledEmployeeSI" class="nhi-section">
              <h3 style="margin: 1rem 0 0.5rem; font-size: 0.95rem; font-weight: 600">
                {{ t('nationalHealthInsurance') }}
              </h3>
              <div class="nhi-toggle-group" role="group" :aria-label="t('nationalHealthInsurance')">
                <UButton
                  :variant="nhiMode === 'manual' ? 'solid' : 'outline'"
                  size="sm"
                  class="nhi-toggle-btn"
                  @click="nhiMode = 'manual'"
                  >{{ t('nhiModeManual') }}</UButton
                >
                <UButton
                  :variant="nhiMode === 'auto' ? 'solid' : 'outline'"
                  size="sm"
                  class="nhi-toggle-btn"
                  @click="nhiMode = 'auto'"
                  >{{ t('nhiModeAuto') }}</UButton
                >
                <UButton
                  :variant="nhiMode === 'municipality' ? 'solid' : 'outline'"
                  size="sm"
                  class="nhi-toggle-btn"
                  :disabled="!municipalityAutoAvailable"
                  @click="nhiMode = 'municipality'"
                  >{{ t('nhiModeCity') }}</UButton
                >
              </div>

              <template v-if="nhiMode === 'manual'">
                <label class="deduction-input-label" style="margin-top: 0.5rem">{{
                  t('nhiTotalAmount')
                }}</label>
                <YenInputNumber v-model="nhiManualAmount" :min="0" :step="1000" />
                <p class="text-sm text-muted">{{ t('nhiTotalIncludesChildSupport') }}</p>
              </template>

              <template v-else-if="nhiMode === 'auto'">
                <label class="deduction-input-label" style="margin-top: 0.5rem">{{
                  t(
                    municipalityChildSupportRates
                      ? 'nhiKintowariExcludingChildSupport'
                      : 'nhiKintowari',
                  )
                }}</label>
                <YenInputNumber v-model="nhiKintowari" :min="0" :step="100" />
                <label class="deduction-input-label" style="margin-top: 0.5rem">{{
                  t(
                    municipalityChildSupportRates
                      ? 'nhiShotokuwariExcludingChildSupport'
                      : 'nhiShotokuwari',
                  )
                }}</label>
                <UInput type="number" v-model.number="nhiShotokuwariRate" :min="0" :step="0.01">
                  <template #trailing><span class="text-sm text-muted">%</span></template>
                </UInput>
                <div v-if="municipalityChildSupportRates" class="nhi-breakdown-row">
                  <span>{{ t('childSupportContribution') }}</span>
                  <span>{{ formatCurrency(nhiChildSupportAmount) }}</span>
                </div>
                <template v-else>
                  <label
                    for="nhi-child-support-rate"
                    class="deduction-input-label"
                    style="margin-top: 0.5rem"
                  >{{ t('nhiChildSupportRate') }}</label>
                  <UInput
                    id="nhi-child-support-rate"
                    type="number"
                    v-model.number="nhiChildSupportRate"
                    :min="0"
                    :step="0.01"
                  >
                    <template #trailing><span class="text-sm text-muted">%</span></template>
                  </UInput>
                  <p class="text-sm text-muted">{{ t('nhiChildSupportRateHelp') }}</p>
                </template>
              </template>

              <template v-else-if="nhiMode === 'municipality' && municipalityNhiBreakdown">
                <p class="text-sm text-muted">{{ t('nhiMunicipalityHelp') }}</p>
                <div class="nhi-municipality-breakdown">
                  <div
                    v-if="municipalityNhiBreakdown.reduction > 0"
                    class="nhi-breakdown-row nhi-breakdown-reduction"
                  >
                    <span>{{ t('nhiPerCapitaReduction') }}</span>
                    <span
                      >{{ municipalityNhiBreakdown.reduction * 100 }}%
                      {{ t('nhiReductionOff') }}</span
                    >
                  </div>
                  <div class="nhi-breakdown-row">
                    <span>{{ t('nhiMedical') }}</span>
                    <span>¥{{ municipalityNhiBreakdown.medical.toLocaleString() }}</span>
                  </div>
                  <div class="nhi-breakdown-row">
                    <span>{{ t('nhiSupport') }}</span>
                    <span>¥{{ municipalityNhiBreakdown.support.toLocaleString() }}</span>
                  </div>
                  <div class="nhi-breakdown-row" v-if="ageGroup === '40to64'">
                    <span>{{ t('nhiLongTermCare') }}</span>
                    <span>¥{{ municipalityNhiBreakdown.kaigo.toLocaleString() }}</span>
                  </div>
                  <div class="nhi-breakdown-row">
                    <span>{{ t('nhiChildSupport') }}</span>
                    <span>¥{{ municipalityNhiBreakdown.kodomo.toLocaleString() }}</span>
                  </div>
                  <div class="nhi-breakdown-row nhi-breakdown-total">
                    <span>{{ t('nhiTotal') }}</span>
                    <span>¥{{ municipalityNhiBreakdown.total.toLocaleString() }}</span>
                  </div>
                </div>
              </template>
              <template v-if="nhiMode !== 'manual' && municipalityChildSupportRates">
                <p class="text-sm text-muted">
                  {{
                    t('nhiChildSupportAutomaticHelp', {
                      rate: (municipalityChildSupportRates.incomeRate * 100).toFixed(2),
                      perCapita: formatCurrency(municipalityChildSupportRates.annualPerCapita),
                      householdCharge: municipalityChildSupportRates.annualHousehold > 0
                        ? t('nhiChildSupportHouseholdCharge', {
                            amount: formatCurrency(municipalityChildSupportRates.annualHousehold),
                          })
                        : '',
                      cap: formatCurrency(municipalityChildSupportRates.annualCap),
                    })
                  }}
                </p>
                <p v-if="nhiMode === 'auto'" class="text-sm text-muted">
                  {{ t('nhiChildSupportExcludeFromInputs') }}
                </p>
                <a
                  :href="municipalityChildSupportRates.sourceUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm underline"
                >{{ t('nhiChildSupportOfficialRates') }}</a>
              </template>
            </div>

            <template v-if="enrolledEmployeeSI">
              <UButton
                variant="ghost"
                size="sm"
                class="settings-toggle-btn"
                :icon="showAdvancedOptions ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'"
                :label="showAdvancedOptions ? t('hideSettings') : t('showSettings')"
                @click="showAdvancedOptions = !showAdvancedOptions"
                style="margin-top: 0.5rem"
              />

              <div v-show="showAdvancedOptions" class="advanced-options-panel">
                <p class="text-sm text-muted">{{ t('childSupportEmployeeHelp') }}</p>
                <div class="input-group">
                  <label>{{ t('unionSelect') }}</label>
                  <USelect
                    v-model="selectedKenpo"
                    :items="kenpoItems"
                    class="styled-select"
                    @update:model-value="handleKenpoChange"
                  />
                </div>

                <div class="input-group">
                  <label>{{ t('customHealth') }}</label>
                  <UInput type="number" v-model.number="customHealthRate" :min="0" :step="0.01">
                    <template #trailing><span class="text-sm text-muted">%</span></template>
                  </UInput>
                </div>

                <div class="input-group">
                  <label>{{ t('customKaigo') }}</label>
                  <UInput type="number" v-model.number="customKaigoRate" :min="0" :step="0.01">
                    <template #trailing><span class="text-sm text-muted">%</span></template>
                  </UInput>
                </div>

                <div class="input-group">
                  <label>{{ t('customPension') }}</label>
                  <UInput type="number" v-model.number="customPensionRate" :min="0" :step="0.01">
                    <template #trailing><span class="text-sm text-muted">%</span></template>
                  </UInput>
                </div>

                <div class="input-group">
                  <label>{{ t('employmentInsIndustry') }}</label>
                  <USelect
                    v-model="selectedIndustry"
                    :items="industryItems"
                    class="styled-select"
                    @update:model-value="handleIndustryChange"
                  />
                </div>

                <div class="input-group">
                  <label>{{ t('customEmploymentIns') }}</label>
                  <UInput
                    type="number"
                    v-model.number="customEmploymentInsRate"
                    :min="0"
                    :step="0.01"
                  >
                    <template #trailing><span class="text-sm text-muted">%</span></template>
                  </UInput>
                </div>
              </div>
            </template>
          </div>

          <div
            v-if="hasSpouseOrDependents"
            class="input-section"
            style="margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #eaeaea"
          >
            <h2>{{ t('spouseAndDependents') }}</h2>

            <div class="si-toggle" style="margin-bottom: 1rem">
              <USwitch v-model="hasSpouse" />
              <span>{{ t('hasSpouse') }}</span>
            </div>

            <div class="input-group" v-if="hasSpouse">
              <label>{{ t('spouseAnnualIncome') }}</label>
              <YenInputNumber v-model="spouseAnnualIncome" :min="0" :step="10000" />
            </div>
            <div class="input-group" v-if="hasSpouse">
              <label>{{ t('spouseAge') }}</label>
              <UInput type="number" v-model.number="spouseAge" :min="0" :max="120" :step="1" />
            </div>

            <div class="card-list" v-if="dependents.length > 0" style="margin-top: 0.75rem">
              <UCard
                v-for="dep in dependents"
                :key="dep.id"
                :ui="{ header: 'py-2 px-3 bg-gray-50', body: 'p-3' }"
              >
                <template #header>
                  <div class="flex justify-between items-center">
                    <span class="text-sm font-semibold">{{ t('dependent') }}</span>
                    <UButton
                      variant="ghost"
                      size="xs"
                      color="error"
                      class="remove-btn"
                      icon="i-lucide-x"
                      @click="removeDependent(dep.id)"
                      :title="t('removeIncome')"
                    />
                  </div>
                </template>
                <div class="input-group" style="margin: 0">
                  <label>{{ t('dependentAge') }}</label>
                  <UInput type="number" v-model.number="dep.age" :min="0" :max="120" :step="1" />
                </div>
              </UCard>
            </div>

            <div style="margin-top: 0.75rem">
              <UButton variant="outline" size="sm" class="outline-btn" @click="addDependent">{{
                t('addDependent')
              }}</UButton>
            </div>
          </div>

          <IncomeSection />

          <DeductionSection @open-wizard="openHomeLoanWizard" @edit-wizard="openHomeLoanEdit" />
        </div>

        <!-- Output Panel -->
        <div class="panel results-panel">
          <div class="results-card">
            <h2>{{ t('annualBreakdown') }}</h2>

            <div class="result-row total-gross">
              <span>{{ t('grossIncome') }}</span>
              <span>{{ formatCurrency(results.annualGross) }}</span>
            </div>
            <div class="result-row deduction sub-item">
              <span>└ {{ t('employmentIncomeDeduction') }}</span>
              <span>- {{ formatCurrency(results.employmentIncomeDeduction) }}</span>
            </div>
            <div class="result-row sub-item employment-income-row">
              <span>= {{ t('employmentIncome') }}</span>
              <span>{{ formatCurrency(results.employmentIncome) }}</span>
            </div>
            <div class="result-row sub-item" v-if="results.businessIncome > 0">
              <span>+ {{ t('businessIncomeName') }}</span>
              <span>{{ formatCurrency(results.businessIncome) }}</span>
            </div>

            <div class="divider"></div>

            <!-- Single SI workplace -->
            <template v-if="!hasMultipleSiEntries">
              <div
                class="result-row deduction social-insurance-row"
                v-if="results.healthInsurance > 0"
              >
                <span
                  >{{ t('healthIns') }}
                  <small class="bracket-info"
                    >{{ t('gradeString') }} {{ results.healthBracket }} ({{
                      formatCurrency(results.healthStandardRemuneration)
                    }})</small
                  ></span
                >
                <span class="social-ins-value"
                  >- {{ formatCurrency(results.healthInsurance) }}</span
                >
              </div>
              <div
                class="result-row deduction social-insurance-row"
                v-if="results.kaigoInsurance > 0"
              >
                <span>{{ t('nursingCare') }}</span>
                <span class="social-ins-value">- {{ formatCurrency(results.kaigoInsurance) }}</span>
              </div>
              <div class="result-row deduction social-insurance-row" v-if="results.pension > 0">
                <span
                  >{{ t('pension') }}
                  <small class="bracket-info"
                    >{{ t('gradeString') }} {{ results.pensionBracket }} ({{
                      formatCurrency(results.pensionStandardRemuneration)
                    }})</small
                  ></span
                >
                <span class="social-ins-value">- {{ formatCurrency(results.pension) }}</span>
              </div>
            </template>

            <!-- Multiple SI workplaces -->
            <template v-else>
              <template v-for="si in siBreakdown" :key="si.entryId + '-health'">
                <div class="result-row deduction social-insurance-row" v-if="si.annualHealth > 0">
                  <span
                    >{{ t('healthIns') }}
                    <small class="bracket-info"
                      >{{ si.label }} — {{ t('gradeString') }} {{ si.healthBracket }} ({{
                        formatCurrency(si.healthStandardRemuneration)
                      }})</small
                    ></span
                  >
                  <span class="social-ins-value">- {{ formatCurrency(si.annualHealth) }}</span>
                </div>
                <div class="result-row deduction social-insurance-row" v-if="si.annualKaigo > 0">
                  <span
                    >{{ t('nursingCare') }} <small class="bracket-info">{{ si.label }}</small></span
                  >
                  <span class="social-ins-value">- {{ formatCurrency(si.annualKaigo) }}</span>
                </div>
                <div class="result-row deduction social-insurance-row" v-if="si.annualPension > 0">
                  <span
                    >{{ t('pension') }}
                    <small class="bracket-info"
                      >{{ si.label }} — {{ t('gradeString') }} {{ si.pensionBracket }} ({{
                        formatCurrency(si.pensionStandardRemuneration)
                      }})</small
                    ></span
                  >
                  <span class="social-ins-value">- {{ formatCurrency(si.annualPension) }}</span>
                </div>
              </template>
            </template>

            <div
              class="result-row deduction social-insurance-row"
              v-if="results.childSupportContribution > 0"
            >
              <span>{{ t('childSupportContribution') }}</span>
              <span class="social-ins-value">
                - {{ formatCurrency(results.childSupportContribution) }}
              </span>
            </div>

            <!-- National Pension (when not in 厚生年金) -->
            <div class="result-row deduction social-insurance-row" v-if="!enrolledEmployeeSI">
              <span>
                {{ t('nationalPension') }}
                <span v-if="pensionResult.exemptionTier !== 'none'" class="pension-exemption-badge">
                  {{
                    pensionResult.exemptionTier === 'full'
                      ? t('pensionFullExemption')
                      : t('pensionPartialExemption', { tier: pensionResult.exemptionTier })
                  }}
                </span>
              </span>
              <span class="social-ins-value">- {{ formatCurrency(results.nationalPension) }}</span>
            </div>

            <div
              class="result-row deduction social-insurance-row"
              v-if="results.nationalHealthInsurance > 0"
            >
              <span>{{ t('nationalHealthInsurance') }}</span>
              <span class="social-ins-value"
                >- {{ formatCurrency(results.nationalHealthInsurance) }}</span
              >
            </div>

            <div
              class="result-row deduction social-insurance-row"
              v-if="results.employmentInsurance > 0"
            >
              <span>{{ t('employmentIns') }}</span>
              <span class="social-ins-value"
                >- {{ formatCurrency(results.employmentInsurance) }}</span
              >
            </div>
            <div class="result-row deduction">
              <span>{{ t('basicExemption') }}</span>
              <span>- {{ formatCurrency(results.basicExemption) }}</span>
            </div>

            <div v-if="autoSpouseDeduction > 0" class="result-row deduction user-deduction-row">
              <span>{{
                locale === 'ja' ? DEDUCTION_DEFS['spouse'].nameJa : DEDUCTION_DEFS['spouse'].nameEn
              }}</span>
              <span>- {{ formatCurrency(autoSpouseDeduction) }}</span>
            </div>
            <div
              v-if="autoDependentDeductions.generalAmount > 0"
              class="result-row deduction user-deduction-row"
            >
              <span>{{
                locale === 'ja'
                  ? DEDUCTION_DEFS['dependent_general'].nameJa
                  : DEDUCTION_DEFS['dependent_general'].nameEn
              }}</span>
              <span>- {{ formatCurrency(autoDependentDeductions.generalAmount) }}</span>
            </div>
            <div
              v-if="autoDependentDeductions.specifiedAmount > 0"
              class="result-row deduction user-deduction-row"
            >
              <span>{{
                locale === 'ja'
                  ? DEDUCTION_DEFS['dependent_specified'].nameJa
                  : DEDUCTION_DEFS['dependent_specified'].nameEn
              }}</span>
              <span>- {{ formatCurrency(autoDependentDeductions.specifiedAmount) }}</span>
            </div>
            <div
              v-if="autoDependentDeductions.agedAmount > 0"
              class="result-row deduction user-deduction-row"
            >
              <span>{{
                locale === 'ja'
                  ? DEDUCTION_DEFS['dependent_aged'].nameJa
                  : DEDUCTION_DEFS['dependent_aged'].nameEn
              }}</span>
              <span>- {{ formatCurrency(autoDependentDeductions.agedAmount) }}</span>
            </div>

            <template v-if="deductionEntries.length > 0">
              <template v-for="entry in deductionEntries" :key="entry.id">
                <div
                  v-if="!DEDUCTION_DEFS[entry.type].isTaxCredit"
                  class="result-row deduction user-deduction-row"
                >
                  <span>
                    {{
                      locale === 'ja'
                        ? DEDUCTION_DEFS[entry.type].nameJa
                        : DEDUCTION_DEFS[entry.type].nameEn
                    }}
                  </span>
                  <span>- {{ formatCurrency(deductionAmountFor(entry)) }}</span>
                </div>
              </template>
            </template>

            <div class="divider"></div>

            <div
              v-if="results.furusato.incomeDeduction > 0"
              class="result-row deduction user-deduction-row"
            >
              <span>{{ t('furusatoIncomeDeduction') }}</span>
              <span>- {{ formatCurrency(results.furusato.incomeDeduction) }}</span>
            </div>

            <div class="result-row taxable-income-row">
              <span>
                {{ t('taxableIncome') }}
              </span>
              <span class="taxable-income-value">{{ formatCurrency(results.taxableIncome) }}</span>
            </div>

            <div class="divider"></div>

            <div class="result-row deduction">
              <span>
                {{ t('incomeTax') }}
                <span
                  class="bracket-info marginal-rate-badge"
                  :title="t('marginalRateSurtax') + ': ' + results.effectiveMarginalRate + '%'"
                >
                  {{ results.marginalRate }}%
                  <span class="marginal-surtax">({{ results.effectiveMarginalRate }}%)</span>
                </span>
              </span>
              <span>- {{ formatCurrency(results.incomeTax) }}</span>
            </div>
            <div
              class="result-row deduction sub-item furusato-credit-row"
              v-if="results.furusatoIncomeTaxCredit > 0"
            >
              <span>✓ {{ t('furusatoIncomeTaxCredit') }}</span>
              <span class="furusato-credit-value"
                >+ {{ formatCurrency(results.furusatoIncomeTaxCredit) }}</span
              >
            </div>
            <div
              class="result-row deduction sub-item home-loan-credit-row"
              v-if="results.homeLoanIncomeTaxCredit > 0"
            >
              <span>✓ {{ t('homeLoanIncomeTaxCredit') }}</span>
              <span class="home-loan-credit-value"
                >+ {{ formatCurrency(results.homeLoanIncomeTaxCredit) }}</span
              >
            </div>

            <div class="result-row deduction">
              <span>{{ t('residentTax') }}</span>
              <span>- {{ formatCurrency(results.residentTax) }}</span>
            </div>
            <div
              class="result-row deduction sub-item furusato-credit-row"
              v-if="results.furusatoResidentTaxCredit > 0"
            >
              <span>✓ {{ t('furusatoResidentTaxCredit') }}</span>
              <span class="furusato-credit-value"
                >+ {{ formatCurrency(results.furusatoResidentTaxCredit) }}</span
              >
            </div>
            <div
              class="result-row deduction sub-item home-loan-credit-row"
              v-if="results.homeLoanResidentTaxCredit > 0"
            >
              <span>✓ {{ t('homeLoanResidentTaxCredit') }}</span>
              <span class="home-loan-credit-value"
                >+ {{ formatCurrency(results.homeLoanResidentTaxCredit) }}</span
              >
            </div>
            <div class="result-row deduction sub-item">
              <span>└ {{ t('residentPref') }}</span>
              <span>- {{ formatCurrency(results.residentTaxPrefectural) }}</span>
            </div>
            <div class="result-row deduction sub-item">
              <span>└ {{ t('residentMuni') }}</span>
              <span>- {{ formatCurrency(results.residentTaxMunicipal) }}</span>
            </div>

            <div class="result-row total-deductions">
              <span>{{ t('totalDeductions') }}</span>
              <span>- {{ formatCurrency(results.totalDeductions) }}</span>
            </div>

            <div class="divider"></div>

            <div class="result-row net-pay highlight">
              <span>{{ t('netPay') }}</span>
              <span class="net-value">{{ formatCurrency(results.netPay) }}</span>
            </div>

            <template v-if="totalCashCost > 0">
              <div
                class="result-row deduction cash-cost-row"
                v-for="entry in cashCostEntries"
                :key="'cc-' + entry.id"
              >
                <span>
                  {{
                    locale === 'ja'
                      ? DEDUCTION_DEFS[entry.type].nameJa
                      : DEDUCTION_DEFS[entry.type].nameEn
                  }}
                  <small class="cash-cost-tag">{{ t('cashCostContributions') }}</small>
                </span>
                <span>- {{ formatCurrency(getCashCost(entry, idecoMonthlyLimit)) }}</span>
              </div>

              <div class="divider"></div>

              <div class="result-row disposable-income-row">
                <span>
                  {{ t('disposableIncome') }}
                  <small class="taxable-income-sub">{{ t('disposableIncomeSub') }}</small>
                </span>
                <span class="net-value">{{ formatCurrency(results.netPay - totalCashCost) }}</span>
              </div>
            </template>

            <div class="estimated-monthly">
              {{ t('monthlyPay') }}:
              <strong>{{
                formatCurrency(
                  hasSalaryIncome
                    ? results.monthlyNet - totalCashCost / 12
                    : (results.netPay - totalCashCost) / 12,
                )
              }}</strong>
              <br />
              <span v-if="hasSalaryIncome && results.annualGross - results.monthlyNet * 12 > 0"
                >{{ t('bonusPay') }}: <strong>{{ formatCurrency(results.bonusNet) }}</strong></span
              >
            </div>
          </div>
        </div>

        <!-- Home Loan Wizard Modal -->
        <HomeLoanWizard
          v-if="showHomeLoanWizard"
          :initial="
            editingHomeLoanId
              ? (deductionEntries.find((e) => e.id === editingHomeLoanId)?.homeLoanParams ?? null)
              : null
          "
          @confirm="handleHomeLoanConfirm"
          @cancel="closeHomeLoanWizard"
        />

        <!-- Visualization Panel -->
        <div class="panel viz-panel">
          <h2 class="viz-title">{{ t('vizTitle') }}</h2>
          <p class="viz-sub">{{ t('vizSubtitle') }}</p>
          <div class="flex flex-col gap-8 w-full">
            <DonutChart
              :slices="pieSlices"
              :center-label="formatCurrency(results.annualGross)"
              :center-sub="t('vizGross')"
            />

            <!-- iDeCo Tax-Saving Tip -->
            <UCard
              v-if="!hasIdecoDeduction && idecoSavings"
              :ui="{ header: 'py-2 px-3', body: 'p-3' }"
            >
              <template #header>
                <div class="flex items-center gap-1.5">
                  <span>💡</span>
                  <span class="text-sm font-semibold text-amber-800">{{ t('idecoTipTitle') }}</span>
                </div>
              </template>
              <p class="text-xs text-amber-700 mb-3 leading-snug">
                {{
                  t('idecoTipDesc', {
                    monthly: formatCurrency(idecoMonthlyLimit),
                    annual: formatCurrency(idecoMonthlyLimit * 12),
                  })
                }}
              </p>
              <table class="ideco-tip-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{{ t('idecoTipCurrent') }}</th>
                    <th>{{ t('idecoTipWithIdeco') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{{ t('idecoTipIncomeTax') }}</td>
                    <td>{{ formatCurrency(results.incomeTax) }}</td>
                    <td class="col-with-ideco">
                      {{ formatCurrency(resultsWithMaxIdeco?.incomeTax ?? 0) }}
                    </td>
                  </tr>
                  <tr>
                    <td>{{ t('idecoTipResidentTax') }}</td>
                    <td>{{ formatCurrency(results.residentTax) }}</td>
                    <td class="col-with-ideco">
                      {{ formatCurrency(resultsWithMaxIdeco?.residentTax ?? 0) }}
                    </td>
                  </tr>
                  <tr class="ideco-tip-savings-row">
                    <td>{{ t('idecoTipSavings') }}</td>
                    <td></td>
                    <td class="ideco-tip-savings-amount">
                      {{ formatCurrency(idecoSavings.total) }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </UCard>
          </div>
        </div>
        </UPageGrid>
      </UContainer>
      <UFooter
        class="app-footer sticky bottom-0 border-t border-gray-200 bg-white/85 backdrop-blur-sm"
        :ui="{ top: 'text-center text-xs text-gray-400 space-y-0.5', container: 'hidden' }"
      >
        <template #top>
          <div style="padding: 0.75rem 0">
            <div>&copy; 2026 Xuanrui Qi</div>
            <div>
              <a
                href="https://github.com/xuanruiqi/japan-tax-calculator"
                target="_blank"
                rel="noopener noreferrer"
                >github.com/xuanruiqi/japan-tax-calculator</a
              >
            </div>
          </div>
        </template>
      </UFooter>
    </div>
  </UApp>
</template>

<style scoped>
.app-shell,
.app-container {
  min-height: 100vh;
}

.theme-dark,
.theme-dark .app-container {
  background: #020617;
}

.top-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

/* Layout — mobile: cards */
.panel {
  background: #ffffff;
  border: 1px solid #eaeaea;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.viz-panel {
  background: #fafafa;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.viz-panel > * {
  width: 100%;
  max-width: 340px;
}

/* Layout — desktop (lg+): restore full-height side-by-side columns */
@media (min-width: 1024px) {
  .panel {
    height: 100vh;
    overflow-y: auto;
    border-radius: 0;
    border: none;
    border-right: 1px solid #eaeaea;
    box-shadow: none;
    padding: 3rem;
  }

  .viz-panel {
    border-right: none;
    background: #fafafa;
    justify-content: flex-start;
    padding: 3rem 2rem;
  }
}

@media (max-width: 640px) {
  .top-controls {
    top: 1rem;
    right: 1rem;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.25rem;
  }
}

.viz-title {
  font-size: 1.2rem;
  font-weight: 600;
  color: #111;
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
}

.viz-sub {
  font-size: 0.85rem;
  color: #999;
  margin-bottom: 2rem;
  text-align: center;
}

/* iDeCo tax-saving tip table */
.ideco-tip-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}

.ideco-tip-table th {
  text-align: right;
  font-weight: 600;
  color: #374151;
  padding: 0.2rem 0.4rem;
  border-bottom: 1px solid #e5e7eb;
}

.ideco-tip-table th:first-child {
  text-align: left;
}

.ideco-tip-table td {
  padding: 0.25rem 0.4rem;
  text-align: right;
  color: #111827;
}

.ideco-tip-table td:first-child {
  text-align: left;
  color: #6b7280;
}

.col-with-ideco {
  color: #16a34a !important;
  font-weight: 500;
}

.ideco-tip-savings-row td {
  border-top: 1px solid #e5e7eb;
  padding-top: 0.4rem;
  font-weight: 600;
}

.ideco-tip-savings-amount {
  color: #15803d !important;
  font-size: 0.95rem;
}

:global(html.dark) .panel {
  background: #111827;
  border-color: #243244;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
}

.theme-dark .panel {
  background: #111827;
  border-color: #243244;
  box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
}

:global(html.dark) .app-shell,
:global(html.dark) .app-container {
  background: #020617;
}

:global(html.dark) .viz-panel {
  background: #020617;
}

.theme-dark .viz-panel {
  background: #020617;
}

@media (min-width: 1024px) {
  :global(html.dark) .panel {
    border-right-color: #243244;
    box-shadow: none;
  }

  .theme-dark .panel {
    border-right-color: #243244;
    box-shadow: none;
  }

  :global(html.dark) .viz-panel {
    background: #020617;
  }

  .theme-dark .viz-panel {
    background: #020617;
  }
}

/* Section headers */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
  padding-right: 7rem; /* clear both stacked fixed toggles on mobile */
}

@media (min-width: 1024px) {
  .section-header {
    padding-right: 0;
  }
}

.section-header h2 {
  margin-bottom: 0;
}

:global(html.dark) .section-header {
  border-color: #243244 !important;
}

.input-section h2,
.results-card h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #111;
  margin-bottom: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:global(html.dark) .input-section h2,
:global(html.dark) .results-card h2,
:global(html.dark) .viz-title {
  color: #f8fafc;
}

.theme-dark .input-section h2,
.theme-dark .results-card h2,
.theme-dark .viz-title {
  color: #f8fafc;
}

/* Form fields */
.input-group {
  margin-bottom: 1.5rem;
}

.input-group label {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #333;
  margin-bottom: 0.4rem;
}

:global(html.dark) .input-group label,
:global(html.dark) .result-row,
:global(html.dark) .taxable-income-row,
:global(html.dark) .estimated-monthly,
:global(html.dark) .ideco-tip-table td,
:global(html.dark) .hl-summary-row span:last-child,
:global(html.dark) .deduction-total,
:global(html.dark) .nhi-breakdown-total {
  color: #cbd5e1;
}

.theme-dark .input-group label,
.theme-dark .result-row,
.theme-dark .taxable-income-row,
.theme-dark .estimated-monthly,
.theme-dark .ideco-tip-table td,
.theme-dark .hl-summary-row span:last-child,
.theme-dark .deduction-total,
.theme-dark .nhi-breakdown-total {
  color: #f8fafc;
}

.input-group small {
  color: #888 !important;
}

:global(html.dark) .input-group small,
:global(html.dark) .si-toggle,
:global(html.dark) .deduction-input-label,
:global(html.dark) .no-deductions-msg,
:global(html.dark) .sub-item,
:global(html.dark) .taxable-income-sub,
:global(html.dark) .viz-sub,
:global(html.dark) .deduction-computed-label,
:global(html.dark) .hl-summary-row,
:global(html.dark) .nhi-breakdown-row {
  color: #94a3b8 !important;
}

.theme-dark .input-group small,
.theme-dark .si-toggle,
.theme-dark .deduction-input-label,
.theme-dark .no-deductions-msg,
.theme-dark .sub-item,
.theme-dark .taxable-income-sub,
.theme-dark .viz-sub,
.theme-dark .deduction-computed-label,
.theme-dark .hl-summary-row,
.theme-dark .nhi-breakdown-row {
  color: #e2e8f0 !important;
}

.si-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #555;
}

.advanced-options-panel {
  padding-top: 1.5rem;
  border-top: 1px dashed #eaeaea;
  margin-top: 0.5rem;
}

:global(html.dark) .advanced-options-panel {
  border-top-color: #243244;
}

.theme-dark .advanced-options-panel {
  border-top-color: #243244;
}

/* Card list */
.card-list {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.deduction-input-label {
  display: block;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.35rem;
}

.no-deductions-msg {
  font-size: 0.85rem;
  color: #aaa;
  margin: 0.5rem 0 1rem;
}

/* Results panel */
.results-card {
  background: #fff;
  padding: 0;
}

:global(html.dark) .results-card {
  background: transparent;
}

.theme-dark .results-card {
  background: transparent;
}

.result-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.95rem;
  color: #444;
}

.total-gross {
  font-weight: 600;
  color: #111;
  font-size: 1.05rem;
}

:global(html.dark) .total-gross,
:global(html.dark) .total-deductions,
:global(html.dark) .net-pay,
:global(html.dark) .taxable-income-value,
:global(html.dark) .disposable-income-row,
:global(html.dark) .deduction-total {
  color: #f8fafc;
}

.theme-dark .total-gross,
.theme-dark .total-deductions,
.theme-dark .net-pay,
.theme-dark .taxable-income-value,
.theme-dark .disposable-income-row,
.theme-dark .deduction-total,
.theme-dark .net-value {
  color: #f8fafc;
}

.deduction {
  color: #555;
}

:global(html.dark) .deduction,
:global(html.dark) .employment-income-row {
  color: #cbd5e1;
}

.theme-dark .deduction,
.theme-dark .employment-income-row {
  color: #f1f5f9;
}

.sub-item {
  font-size: 0.85rem;
  padding-left: 1rem;
  margin-top: -0.25rem;
  color: #777;
}

.total-deductions {
  font-weight: 500;
  color: #111;
  margin-top: 1rem;
}

.divider {
  height: 1px;
  background: #eaeaea;
  margin: 1.25rem 0;
}

:global(html.dark) .divider,
:global(html.dark) .deductions-section,
:global(html.dark) .deduction-total,
:global(html.dark) .employment-income-row {
  border-color: #243244;
}

.theme-dark .divider,
.theme-dark .deductions-section,
.theme-dark .deduction-total,
.theme-dark .employment-income-row {
  border-color: #243244;
}

.net-pay {
  align-items: center;
  font-weight: 600;
  color: #111;
}

.net-value {
  font-size: 1.5rem;
}

.estimated-monthly {
  text-align: center;
  margin-top: 2rem;
  padding: 1rem;
  background: #f9f9f9;
  border: 1px solid #eaeaea;
  border-radius: 6px;
  color: #333;
  font-size: 1rem;
  font-weight: 500;
}

:global(html.dark) .estimated-monthly {
  background: #0f172a;
  border-color: #243244;
}

.theme-dark .estimated-monthly {
  background: #0f172a;
  border-color: #243244;
}

.bracket-info {
  display: inline-block;
  margin-left: 0.5rem;
  padding: 0.1rem 0.4rem;
  background-color: #f0f0f0;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  color: #666;
  vertical-align: middle;
}

:global(html.dark) .bracket-info {
  background-color: #1e293b;
  color: #cbd5e1;
}

.theme-dark .bracket-info {
  background-color: #1e293b;
  color: #f8fafc;
}

.marginal-rate-badge {
  background-color: #edf2ff;
  color: #3b5bdb;
  cursor: default;
}

:global(html.dark) .marginal-rate-badge {
  background-color: rgba(59, 91, 219, 0.18);
  color: #a5b4fc;
}

.theme-dark .marginal-rate-badge {
  background-color: rgba(59, 91, 219, 0.18);
  color: #e0e7ff;
}

.marginal-surtax {
  opacity: 0.65;
  font-weight: 400;
}

.taxable-income-row {
  font-weight: 500;
  color: #333;
  align-items: baseline;
}

.taxable-income-sub {
  display: block;
  font-size: 0.75rem;
  font-weight: 400;
  color: #999;
  margin-top: 0.1rem;
}

.taxable-income-value {
  font-weight: 600;
  color: #111;
}

.employment-income-row {
  color: #555;
  font-weight: 500;
  border-top: 1px dashed #eaeaea;
  padding-top: 0.4rem;
  margin-top: 0.1rem;
}

.social-insurance-row {
  color: #2d4a3e;
  padding-left: 0.75rem;
  border-left: 3px solid #6fcfad;
  margin-left: -0.75rem;
  font-weight: 500;
}

.social-ins-value {
  font-weight: 600;
  color: #1a6b50;
}

:global(html.dark) .social-insurance-row,
:global(html.dark) .furusato-credit-row,
:global(html.dark) .furusato-credit-value {
  color: #86efac;
}

:global(html.dark) .social-ins-value {
  color: #86efac;
}

.theme-dark .social-insurance-row,
.theme-dark .furusato-credit-row,
.theme-dark .furusato-credit-value,
.theme-dark .social-ins-value {
  color: #86efac;
}

/* Deductions section */
.deductions-section {
  border-top: 1px solid #eaeaea;
  padding-top: 2rem;
  margin-top: 1rem;
}

.deductions-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.deductions-header h2 {
  margin: 0;
}

.deduction-computed {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 0.55rem;
  padding-top: 0.45rem;
  border-top: 1px dashed #eee;
}

.deduction-computed-label {
  font-size: 0.78rem;
  color: #888;
}

.deduction-computed-value {
  font-size: 0.9rem;
  font-weight: 600;
  color: #3b5bdb;
}

:global(html.dark) .deduction-computed-value,
:global(html.dark) .user-deduction-row,
:global(html.dark) .user-deduction-row span:last-child,
:global(html.dark) .home-loan-credit-row,
:global(html.dark) .home-loan-credit-value,
:global(html.dark) .furusato-sim-link,
:global(html.dark) .nta-reference-link {
  color: #a5b4fc;
}

.theme-dark .deduction-computed-value,
.theme-dark .user-deduction-row,
.theme-dark .user-deduction-row span:last-child,
.theme-dark .home-loan-credit-row,
.theme-dark .home-loan-credit-value,
.theme-dark .furusato-sim-link,
.theme-dark .nta-reference-link {
  color: #e0e7ff;
}

.user-deduction-row {
  color: #3b4a7a;
  padding-left: 0.75rem;
  border-left: 3px solid #bac8ff;
  margin-left: -0.75rem;
}

.user-deduction-row span:last-child {
  color: #3b5bdb;
  font-weight: 500;
}

.cash-cost-row {
  color: #6b3d00;
}

.cash-cost-row span:last-child {
  color: #b75e00;
  font-weight: 500;
}

.cash-cost-tag {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.1rem 0.4rem;
  background: #fff4e6;
  color: #b75e00;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 500;
  vertical-align: middle;
}

:global(html.dark) .cash-cost-row {
  color: #fcd34d;
}

:global(html.dark) .cash-cost-row span:last-child,
:global(html.dark) .cash-cost-tag {
  color: #fdba74;
}

:global(html.dark) .cash-cost-tag {
  background: rgba(180, 83, 9, 0.2);
}

.theme-dark .cash-cost-row {
  color: #fde68a;
}

.theme-dark .cash-cost-row span:last-child,
.theme-dark .cash-cost-tag {
  color: #fdba74;
}

.theme-dark .cash-cost-tag {
  background: rgba(180, 83, 9, 0.2);
}

.disposable-income-row {
  font-weight: 600;
  color: #111;
  align-items: baseline;
}

.ideco-note {
  display: block;
  font-size: 0.78rem;
  color: #999;
  font-weight: 400;
  margin-top: 0.25rem;
  font-style: italic;
}

:global(html.dark) .ideco-note {
  color: #94a3b8;
}

.theme-dark .ideco-note {
  color: #e2e8f0;
}

.furusato-credit-row {
  color: #1a6b50;
}

.furusato-credit-value {
  font-weight: 600;
  color: #1a6b50;
}

.home-loan-credit-row {
  color: #3b5bdb;
}

.home-loan-credit-value {
  font-weight: 600;
  color: #3b5bdb;
}

.furusato-sim-link,
.nta-reference-link {
  display: block;
  margin-top: 0.45rem;
  font-size: 0.78rem;
  color: #3b5bdb;
  text-decoration: none;
  transition: color 0.2s;
}

.furusato-sim-link:hover,
.nta-reference-link:hover {
  color: #111;
  text-decoration: underline;
}

.hl-summary-row {
  display: flex;
  justify-content: space-between;
  font-size: 0.82rem;
  color: #666;
  padding: 0.2rem 0;
}

.hl-summary-row span:last-child {
  font-weight: 600;
  color: #333;
}

.deduction-total {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1rem;
  padding: 0.75rem 0;
  border-top: 1px solid #eaeaea;
  font-size: 0.92rem;
  font-weight: 600;
  color: #111;
}

.nhi-municipality-breakdown {
  margin-top: 0.6rem;
  border: 1px solid #e6e6e6;
  border-radius: 6px;
  overflow: hidden;
  font-size: 0.88rem;
}

:global(html.dark) .nhi-municipality-breakdown {
  border-color: #243244;
}

.theme-dark .nhi-municipality-breakdown {
  border-color: #243244;
}

.nhi-breakdown-row {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0.7rem;
  border-bottom: 1px solid #f0f0f0;
  color: #555;
}

:global(html.dark) .nhi-breakdown-row {
  border-bottom-color: #1e293b;
}

.theme-dark .nhi-breakdown-row {
  border-bottom-color: #1e293b;
}
.nhi-breakdown-row:last-child {
  border-bottom: none;
}
.nhi-breakdown-total {
  font-weight: 600;
  color: #111;
  background: #f7f7f7;
}

:global(html.dark) .nhi-breakdown-total {
  background: #0f172a;
}

.theme-dark .nhi-breakdown-total {
  background: #0f172a;
}
.nhi-breakdown-reduction {
  color: #2e7d32;
  background: #f1f8f1;
  font-size: 0.82rem;
  font-weight: 500;
}

:global(html.dark) .nhi-breakdown-reduction,
:global(html.dark) .pension-exemption-badge {
  color: #86efac;
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.3);
}

.theme-dark .nhi-breakdown-reduction,
.theme-dark .pension-exemption-badge {
  color: #86efac;
  background: rgba(34, 197, 94, 0.14);
  border-color: rgba(34, 197, 94, 0.3);
}

.pension-exemption-badge {
  display: inline-block;
  margin-left: 0.4rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
  background: #f1f8f1;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
  vertical-align: middle;
}
</style>
