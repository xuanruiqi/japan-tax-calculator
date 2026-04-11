<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { calculateTaxesAndInsurance, getStandardRemunerationGrade } from './utils/taxCalculation';
import { computeNhiIncomes, calculateMunicipalityNhi, isMunicipalitySupported, type NhiBreakdown } from './utils/nhiCalculation';
import { calculateNationalPension, type PensionResult } from './utils/kokunenCalculation';
import { PREFECTURES_LIST, KYOKAI_KENPO_RATES, RESIDENT_TAX_RATES, PREFECTURE_NAMES, CITY_NAMES } from './data/taxRates';
import { translations } from './locales';
import {
  type DeductionEntry, type DeductionType,
  DEDUCTION_DEFS, DEDUCTION_ORDER, calculateDeductionAmount, getCashCost
} from './data/deductions';
import { calculateHomeLoanCredit, type HomeLoanParams } from './data/homeLoan';
import DonutChart, { type PieSlice } from './components/DonutChart.vue';
import HomeLoanWizard from './components/HomeLoanWizard.vue';

const currentLocale = ref<'en' | 'ja'>('ja');
const t = computed(() => translations[currentLocale.value]);

const previousYearIncomeInput = ref<number | null | ''>(null);

type IncomeType = 'salary' | 'business';

interface IncomeEntry {
  id: string;
  type: IncomeType;
  name: string;                   // user-given name for this income source
  monthlySalary: number | null;  // salary only
  annualBonus: number | null;    // salary only
  revenue: number | null;        // business only
  expenses: number | null;       // business only
  joinsSocialInsurance: boolean;      // salary only — whether health/pension is enrolled at this workplace
  joinsEmploymentInsurance: boolean;  // salary only — whether employment insurance is enrolled at this workplace
}

const incomeEntries = ref<IncomeEntry[]>([
  { id: 'salary-default', type: 'salary', name: '', monthlySalary: 300000, annualBonus: 0, revenue: null, expenses: null, joinsSocialInsurance: true, joinsEmploymentInsurance: true },
]);
const addIncomeEntry = (type: IncomeType) => {
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
  });
};

const removeIncomeEntry = (id: string) => {
  incomeEntries.value = incomeEntries.value.filter(e => e.id !== id);
};

// Derived values for calculation — primary salary is the first salary entry
const primarySalaryEntry = computed(() => incomeEntries.value.find(e => e.type === 'salary'));
const hasSalaryIncome = computed(() => !!primarySalaryEntry.value);
const monthlySalaryInput = computed(() => primarySalaryEntry.value?.monthlySalary ?? 0);
const annualBonusInput = computed(() => primarySalaryEntry.value?.annualBonus ?? 0);

const employmentPrefecture = ref<string>("tokyo");
const residencePrefecture = ref<string>("tokyo");
const residenceCity = ref<string>("standard");

const handleResidencePrefectureChange = () => {
  residenceCity.value = "standard";
};

const availableCities = computed(() => {
  const pref = RESIDENT_TAX_RATES[residencePrefecture.value];
  if (!pref) return [];
  return Object.keys(pref.cities);
});

const prefName = (id: string) => PREFECTURE_NAMES[id]?.[currentLocale.value] ?? id;
const cityName = (id: string) => CITY_NAMES[id]?.[currentLocale.value] ?? id;

const prefectureItems = computed(() =>
  PREFECTURES_LIST.map(pref => ({ label: prefName(pref), value: pref }))
);
const cityItems = computed(() => [
  { label: t.value.standardCity, value: 'standard' },
  ...availableCities.value.map(city => ({ label: cityName(city), value: city })),
]);
const ageGroupItems = computed(() => [
  { label: t.value.ageUnder40, value: 'under40' as const },
  { label: t.value.age40to64, value: '40to64' as const },
  { label: t.value.age65over, value: '65over' as const },
]);
const kenpoItems = computed(() => [
  { label: t.value.unionKyokai, value: 'kyokai' as const },
  { label: t.value.unionIts, value: 'its' as const },
  { label: t.value.unionTjk, value: 'tjk' as const },
  { label: t.value.unionOther, value: 'other' as const },
]);
const industryItems = computed(() => [
  { label: t.value.industryGeneral, value: 'general' as const },
  { label: t.value.industryAgriForestry, value: 'agriForestry' as const },
  { label: t.value.industryConstruction, value: 'construction' as const },
]);
const incomePickerItems = computed(() => [[
  { label: t.value.salaryIncomeName, onSelect: () => addIncomeEntry('salary') },
  { label: t.value.businessIncomeName, onSelect: () => addIncomeEntry('business') },
]]);
const deductionPickerItems = computed(() => [
  availableDeductionTypes.value.map(type => ({
    label: currentLocale.value === 'ja' ? DEDUCTION_DEFS[type].nameJa : DEDUCTION_DEFS[type].nameEn,
    onSelect: () => addDeduction(type),
  })),
]);

type KenpoType = 'kyokai' | 'its' | 'tjk' | 'other';
const selectedKenpo = ref<KenpoType>('kyokai');

type AgeGroupType = 'under40' | '40to64' | '65over';
const ageGroup = ref<AgeGroupType>('under40');

const enrolledEmployeeSI = ref<boolean>(true);

watch(enrolledEmployeeSI, (newVal) => {
  const entries = incomeEntries.value;
  const sole = entries.length === 1 ? entries[0] : undefined;
  if (!newVal && sole?.type === 'salary') {
    // Toggled off with a single salary card → convert to business
    const annualGross = (Number(sole.monthlySalary) || 0) * 12 + (Number(sole.annualBonus) || 0);
    incomeEntries.value = [{ id: sole.id, type: 'business', name: sole.name, monthlySalary: null, annualBonus: null, revenue: annualGross, expenses: 0, joinsSocialInsurance: false, joinsEmploymentInsurance: false }];
  } else if (newVal && sole?.type === 'business') {
    // Toggled on with a single business card → convert to salary
    const monthly = Math.round((Number(sole.revenue) || 0) / 12);
    incomeEntries.value = [{ id: sole.id, type: 'salary', name: sole.name, monthlySalary: monthly, annualBonus: 0, revenue: null, expenses: null, joinsSocialInsurance: true, joinsEmploymentInsurance: true }];
  }
});

type NhiMode = 'manual' | 'auto' | 'municipality';
const nhiMode = ref<NhiMode>('manual');
const nhiManualAmount = ref<number | null>(null);
const nhiKintowari = ref<number | null>(null);
const nhiShotokuwariRate = ref<number | null>(null);

const showAdvancedOptions = ref<boolean>(false);

const customHealthRate = ref<number | null>(4.99);
const customKaigoRate = ref<number | null>(0);
const customPensionRate = ref<number | null>(9.15);
const customEmploymentInsRate = ref<number | null>(0.6);

type IndustryType = 'general' | 'agriForestry' | 'construction';
const selectedIndustry = ref<IndustryType>('general');

const handleIndustryChange = () => {
  if (selectedIndustry.value === 'general') {
    customEmploymentInsRate.value = 0.6;
  } else {
    customEmploymentInsRate.value = 0.7;
  }
};

const updateKaigoRate = () => {
  if (ageGroup.value !== '40to64') {
    customKaigoRate.value = 0;
    return;
  }
  if (selectedKenpo.value === 'kyokai') {
    customKaigoRate.value = 0.80; // 1.60% / 2
  } else if (selectedKenpo.value === 'its' || selectedKenpo.value === 'tjk') {
    customKaigoRate.value = 0.90; // 1.80% / 2
  } else if (selectedKenpo.value === 'other' && customKaigoRate.value === 0) {
    customKaigoRate.value = 0.80; // default to generic
  }
};
const handleKenpoChange = () => {
  if (selectedKenpo.value === 'kyokai') {
    customHealthRate.value = KYOKAI_KENPO_RATES[employmentPrefecture.value] || 4.99;
  } else if (selectedKenpo.value === 'its') {
    customHealthRate.value = 4.75;
  } else if (selectedKenpo.value === 'tjk') {
    customHealthRate.value = 4.45;
  } else if (selectedKenpo.value === 'other') {
    showAdvancedOptions.value = true;
  }
  updateKaigoRate();
};

// --- Deductions ---
const deductionEntries = ref<DeductionEntry[]>([]);

// --- State Persistence ---
const STORAGE_KEY = 'tax-calculator-state';

interface SavedState {
  currentLocale: 'en' | 'ja';
  enrolledEmployeeSI: boolean;
  nhiMode: NhiMode;
  nhiManualAmount: number | null;
  nhiKintowari: number | null;
  nhiShotokuwariRate: number | null;
  incomeEntries: IncomeEntry[];
  previousYearIncomeInput: number | null | '';
  employmentPrefecture: string;
  residencePrefecture: string;
  residenceCity: string;
  selectedKenpo: KenpoType;
  ageGroup: AgeGroupType;
  showAdvancedOptions: boolean;
  customHealthRate: number | null;
  customKaigoRate: number | null;
  customPensionRate: number | null;
  customEmploymentInsRate: number | null;
  selectedIndustry: IndustryType;
  deductionEntries: DeductionEntry[];
}

const saveState = () => {
  const state: SavedState = {
    currentLocale: currentLocale.value,
    enrolledEmployeeSI: enrolledEmployeeSI.value,
    nhiMode: nhiMode.value,
    nhiManualAmount: nhiManualAmount.value,
    nhiKintowari: nhiKintowari.value,
    nhiShotokuwariRate: nhiShotokuwariRate.value,
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
  };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
};

const loadState = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const s: Partial<SavedState> = JSON.parse(raw);
    if (s.currentLocale != null) currentLocale.value = s.currentLocale;
    if (s.enrolledEmployeeSI != null) enrolledEmployeeSI.value = s.enrolledEmployeeSI;
    if (s.nhiMode != null) nhiMode.value = s.nhiMode;
    if (s.nhiManualAmount !== undefined) nhiManualAmount.value = s.nhiManualAmount;
    if (s.nhiKintowari !== undefined) nhiKintowari.value = s.nhiKintowari;
    if (s.nhiShotokuwariRate !== undefined) nhiShotokuwariRate.value = s.nhiShotokuwariRate;
    if (s.incomeEntries != null) incomeEntries.value = s.incomeEntries;
    if (s.previousYearIncomeInput !== undefined) previousYearIncomeInput.value = s.previousYearIncomeInput;
    if (s.employmentPrefecture != null) employmentPrefecture.value = s.employmentPrefecture;
    if (s.residencePrefecture != null) residencePrefecture.value = s.residencePrefecture;
    if (s.residenceCity != null) residenceCity.value = s.residenceCity;
    if (s.selectedKenpo != null) selectedKenpo.value = s.selectedKenpo;
    if (s.ageGroup != null) ageGroup.value = s.ageGroup;
    if (s.showAdvancedOptions != null) showAdvancedOptions.value = s.showAdvancedOptions;
    if (s.customHealthRate !== undefined) customHealthRate.value = s.customHealthRate;
    if (s.customKaigoRate !== undefined) customKaigoRate.value = s.customKaigoRate;
    if (s.customPensionRate !== undefined) customPensionRate.value = s.customPensionRate;
    if (s.customEmploymentInsRate !== undefined) customEmploymentInsRate.value = s.customEmploymentInsRate;
    if (s.selectedIndustry != null) selectedIndustry.value = s.selectedIndustry;
    if (s.deductionEntries != null) deductionEntries.value = s.deductionEntries;
  } catch {}
};

const resetState = () => {
  currentLocale.value = 'ja';
  enrolledEmployeeSI.value = true;
  nhiMode.value = 'manual';
  nhiManualAmount.value = null;
  nhiKintowari.value = null;
  nhiShotokuwariRate.value = null;
  incomeEntries.value = [
    { id: 'salary-default', type: 'salary', name: '', monthlySalary: 300000, annualBonus: 0, revenue: null, expenses: null, joinsSocialInsurance: true, joinsEmploymentInsurance: true },
  ];
  previousYearIncomeInput.value = null;
  employmentPrefecture.value = 'tokyo';
  residencePrefecture.value = 'tokyo';
  residenceCity.value = 'standard';
  selectedKenpo.value = 'kyokai';
  ageGroup.value = 'under40';
  showAdvancedOptions.value = false;
  customHealthRate.value = 4.99;
  customKaigoRate.value = 0;
  customPensionRate.value = 9.15;
  customEmploymentInsRate.value = 0.6;
  selectedIndustry.value = 'general';
  deductionEntries.value = [];
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
};

loadState();

watch(
  [
    currentLocale, enrolledEmployeeSI, nhiMode, nhiManualAmount, nhiKintowari, nhiShotokuwariRate,
    incomeEntries, previousYearIncomeInput,
    employmentPrefecture, residencePrefecture, residenceCity,
    selectedKenpo, ageGroup, showAdvancedOptions,
    customHealthRate, customKaigoRate, customPensionRate, customEmploymentInsRate,
    selectedIndustry, deductionEntries,
  ],
  saveState,
  { deep: true },
);

watch(employmentPrefecture, (newPref) => {
  if (selectedKenpo.value === 'kyokai') {
    customHealthRate.value = KYOKAI_KENPO_RATES[newPref] || 4.99;
  }
});

watch(ageGroup, () => {
  updateKaigoRate();
});


const showHomeLoanWizard = ref(false);
const editingHomeLoanId = ref<string | null>(null);

// Self-employed (no salary with social insurance) → ¥68,000/month; otherwise employee → ¥23,000/month
const idecoMonthlyLimit = computed(() =>
  incomeEntries.value.some(e => e.type === 'salary' && e.joinsSocialInsurance) ? 23000 : 68000
);

const availableDeductionTypes = computed(() => {
  const used = new Set(deductionEntries.value.map(d => d.type));
  // Dependents can be added multiple times via count; others are singletons
  const singletons: DeductionType[] = ['life_insurance','earthquake_insurance','medical_expense','furusato','ideco','spouse','home_loan'];
  return DEDUCTION_ORDER.filter(type => {
    if (singletons.includes(type)) return !used.has(type);
    return true; // counts — always available, user just bumps the number
  });
});

const totalAdditionalDeductions = computed(() => {
  const salaryGross = incomeEntries.value
    .filter(e => e.type === 'salary')
    .reduce((sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0), 0);
  const bizIncome = incomeEntries.value
    .filter(e => e.type === 'business')
    .reduce((sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)), 0);
  const gross = salaryGross + bizIncome;
  return deductionEntries.value
    .filter(e => !DEDUCTION_DEFS[e.type].isTaxCredit)  // tax-credit types are NOT income deductions
    .reduce((sum, entry) => sum + calculateDeductionAmount(entry.type, entry.value, gross, idecoMonthlyLimit.value), 0);
});

const furusatoNetDonation = computed(() => {
  const furusato = deductionEntries.value.find(e => e.type === 'furusato');
  if (!furusato || !furusato.value) return 0;
  return Math.max(0, furusato.value - 2000);
});

const homeLoanCreditAmount = computed(() => {
  const entry = deductionEntries.value.find(e => e.type === 'home_loan');
  if (!entry?.homeLoanParams) return 0;
  return calculateHomeLoanCredit(entry.homeLoanParams);
});

const addDeduction = (type: DeductionType) => {
  if (type === 'home_loan') {
    editingHomeLoanId.value = null;
    showHomeLoanWizard.value = true;
    return;
  }
  deductionEntries.value.push({
    id: `${type}-${Date.now()}`,
    type,
    value: DEDUCTION_DEFS[type].inputIsCount ? 1 : 0,
  });
};

const handleHomeLoanConfirm = (params: HomeLoanParams) => {
  const credit = calculateHomeLoanCredit(params);
  if (editingHomeLoanId.value) {
    const entry = deductionEntries.value.find(e => e.id === editingHomeLoanId.value);
    if (entry) {
      entry.homeLoanParams = params;
      entry.value = credit;
    }
  } else {
    deductionEntries.value.push({
      id: `home_loan-${Date.now()}`,
      type: 'home_loan',
      value: credit,
      homeLoanParams: params,
    });
  }
  showHomeLoanWizard.value = false;
  editingHomeLoanId.value = null;
};

const openHomeLoanEdit = (id: string) => {
  editingHomeLoanId.value = id;
  showHomeLoanWizard.value = true;
};


const removeDeduction = (id: string) => {
  deductionEntries.value = deductionEntries.value.filter(d => d.id !== id);
};

const deductionAmountFor = (entry: DeductionEntry) => {
  const salaryGross = incomeEntries.value
    .filter(e => e.type === 'salary')
    .reduce((sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0), 0);
  const bizIncome = incomeEntries.value
    .filter(e => e.type === 'business')
    .reduce((sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)), 0);
  return calculateDeductionAmount(entry.type, entry.value, salaryGross + bizIncome, idecoMonthlyLimit.value);
};

const totalCashCost = computed(() =>
  deductionEntries.value.reduce((sum, e) => sum + getCashCost(e, idecoMonthlyLimit.value), 0)
);

const cashCostEntries = computed(() =>
  deductionEntries.value.filter(e => getCashCost(e, idecoMonthlyLimit.value) > 0)
);

// Resolve income figures for NHI / pension base calculation.
// NHI and pension are assessed on *previous-year* income, mirroring resident tax.
// When previousYearIncomeInput is set we use it as salary gross (same convention as
// resident tax in taxCalculation.ts); otherwise we fall back to current-year entries.
function getNhiIncomes(): { salaryGross: number; bizIncome: number } {
  const prevRaw = previousYearIncomeInput.value;
  if (prevRaw !== null && prevRaw !== '' && Number(prevRaw) >= 0) {
    return { salaryGross: Number(prevRaw), bizIncome: 0 };
  }
  const salaryGross = incomeEntries.value
    .filter(e => e.type === 'salary')
    .reduce((sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0), 0);
  const bizIncome = incomeEntries.value
    .filter(e => e.type === 'business')
    .reduce((sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)), 0);
  return { salaryGross, bizIncome };
}

const municipalityAutoAvailable = computed(() => isMunicipalitySupported(residenceCity.value));

// National Pension exemption (only relevant when not in employee SI)
const pensionResult = computed((): PensionResult => {
  if (enrolledEmployeeSI.value) return { monthlyPremium: 0, annualPremium: 0, exemptionTier: 'none' };
  const { salaryGross, bizIncome } = getNhiIncomes();
  const { totalIncome } = computeNhiIncomes(salaryGross, bizIncome);
  return calculateNationalPension(totalIncome);
});

// If the city changes and municipality mode is no longer supported, fall back to manual
watch(municipalityAutoAvailable, (available) => {
  if (!available && nhiMode.value === 'municipality') nhiMode.value = 'manual';
});

// Municipality NHI breakdown (null when city not supported)
const municipalityNhiBreakdown = computed((): NhiBreakdown | null => {
  const { salaryGross, bizIncome } = getNhiIncomes();
  const { totalIncome, base } = computeNhiIncomes(salaryGross, bizIncome);
  return calculateMunicipalityNhi(residenceCity.value, totalIncome, base, ageGroup.value);
});

// Compute NHI amount (only relevant when not in employee SI)
const nhiAmount = computed(() => {
  if (enrolledEmployeeSI.value) return 0;
  if (nhiMode.value === 'manual') {
    return Math.max(0, Number(nhiManualAmount.value) || 0);
  }
  if (nhiMode.value === 'municipality') {
    return municipalityNhiBreakdown.value?.total ?? 0;
  }
  // Auto mode: 所得割 + 均等割
  const { salaryGross, bizIncome } = getNhiIncomes();
  const { base } = computeNhiIncomes(salaryGross, bizIncome);
  const shotokuwari = Math.floor(base * (Number(nhiShotokuwariRate.value) || 0) / 100);
  const kintowari = Number(nhiKintowari.value) || 0;
  return shotokuwari + kintowari;
});

const results = computed(() => {
  const salary = Number(monthlySalaryInput.value) || 0;
  const bonus = Number(annualBonusInput.value) || 0;

  const prevIncomeRaw = previousYearIncomeInput.value;
  const prevIncome = (prevIncomeRaw == null || prevIncomeRaw === '') ? null : Number(prevIncomeRaw);
  const hRate = customHealthRate.value !== null ? Number(customHealthRate.value) / 100 : 0.0499;
  const kRate = customKaigoRate.value !== null ? Number(customKaigoRate.value) / 100 : 0;
  const pRate = customPensionRate.value !== null ? Number(customPensionRate.value) / 100 : 0.0915;
  const eRate = customEmploymentInsRate.value !== null ? Number(customEmploymentInsRate.value) / 100 : 0.006;

  // Non-primary salary entries
  const nonPrimaryEntries = incomeEntries.value.filter(e => e.type === 'salary' && e !== primarySalaryEntry.value);
  const additionalSalaryGross = nonPrimaryEntries
    .reduce((sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0), 0);

  // Social/employment insurance from non-primary workplaces
  let additionalHealthInsurance = 0;
  let additionalKaigoInsurance = 0;
  let additionalPension = 0;
  for (const entry of nonPrimaryEntries) {
    const ms = Number(entry.monthlySalary) || 0;
    const ab = Number(entry.annualBonus) || 0;
    if (entry.joinsSocialInsurance) {
      const hObj = getStandardRemunerationGrade(ms, 1390000);
      const pObj = getStandardRemunerationGrade(ms, 650000);
      const bonusStdH = Math.min(Math.floor(ab / 1000) * 1000, 5730000);
      const bonusStdP = Math.min(Math.floor(ab / 1000) * 1000, 1500000);
      additionalHealthInsurance += Math.floor(hObj.value * hRate) * 12 + Math.floor(bonusStdH * hRate);
      additionalKaigoInsurance += Math.floor(hObj.value * kRate) * 12 + Math.floor(bonusStdH * kRate);
      additionalPension += Math.floor(pObj.value * pRate) * 12 + Math.floor(bonusStdP * pRate);
    }
  }

  // Total net business income
  const totalBusinessIncome = incomeEntries.value
    .filter(e => e.type === 'business')
    .reduce((sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)), 0);

  const prefData = RESIDENT_TAX_RATES[residencePrefecture.value];
  let localTaxRates = prefData ? prefData.default : { prefIncomeRate: 0.04, cityIncomeRate: 0.06, prefPerCapita: 1500, cityPerCapita: 3500 };

  if (prefData && residenceCity.value !== "standard") {
    const cityOverrides = prefData.cities[residenceCity.value];
    if (cityOverrides) {
      localTaxRates = cityOverrides;
    }
  }

  const globalSI = enrolledEmployeeSI.value;

  return calculateTaxesAndInsurance(salary, bonus, {
    previousYearGross: prevIncome,
    healthInsuranceRate: globalSI ? hRate : 0,
    kaigoInsuranceRate: globalSI ? kRate : 0,
    pensionRate: globalSI ? pRate : 0,
    nationalPensionAmount: globalSI ? 0 : pensionResult.value.annualPremium,
    nationalHealthInsuranceAmount: globalSI ? 0 : nhiAmount.value,
    employmentInsuranceRate: primarySalaryEntry.value?.joinsEmploymentInsurance !== false ? eRate : 0,
    primaryJoinsSocialInsurance: primarySalaryEntry.value?.joinsSocialInsurance !== false,
    additionalSalaryGross,
    additionalHealthInsurance: globalSI ? additionalHealthInsurance : 0,
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
  });
});

interface SiBreakdownEntry {
  entryId: string;
  label: string;
  healthBracket: number;
  pensionBracket: number;
  healthStandardRemuneration: number;
  pensionStandardRemuneration: number;
  annualHealth: number;
  annualKaigo: number;
  annualPension: number;
}

const siBreakdown = computed((): SiBreakdownEntry[] => {
  const globalSI = enrolledEmployeeSI.value;
  if (!globalSI) return [];
  const hRate = globalSI ? (customHealthRate.value !== null ? Number(customHealthRate.value) / 100 : 0.0499) : 0;
  const kRate = globalSI ? (customKaigoRate.value !== null ? Number(customKaigoRate.value) / 100 : 0) : 0;
  const pRate = globalSI ? (customPensionRate.value !== null ? Number(customPensionRate.value) / 100 : 0.0915) : 0;
  const locale = currentLocale.value;
  const entries: SiBreakdownEntry[] = [];
  let salaryIndex = 0;

  for (const entry of incomeEntries.value) {
    if (entry.type !== 'salary' || !entry.joinsSocialInsurance) continue;
    salaryIndex++;
    const ms = Number(entry.monthlySalary) || 0;
    const ab = Number(entry.annualBonus) || 0;
    const hObj = getStandardRemunerationGrade(ms, 1390000);
    const pObj = getStandardRemunerationGrade(ms, 650000);
    const pBracket = pObj.grade > 0 ? Math.max(1, pObj.grade - 3) : 0;
    const bonusStdH = Math.min(Math.floor(ab / 1000) * 1000, 5730000);
    const bonusStdP = Math.min(Math.floor(ab / 1000) * 1000, 1500000);
    const annualHealth = Math.floor(hObj.value * hRate) * 12 + Math.floor(bonusStdH * hRate);
    const annualKaigo = Math.floor(hObj.value * kRate) * 12 + Math.floor(bonusStdH * kRate);
    const annualPension = Math.floor(pObj.value * pRate) * 12 + Math.floor(bonusStdP * pRate);
    const defaultLabel = entry === primarySalaryEntry.value
      ? (locale === 'ja' ? '主' : 'Primary')
      : (locale === 'ja' ? `副${salaryIndex}` : `Job ${salaryIndex}`);
    const label = entry.name || defaultLabel;
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
    });
  }
  return entries;
});

const hasMultipleSiEntries = computed(() => siBreakdown.value.length > 1);

// Format JPY correctly
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);
};

// Pie chart slices
const pieSlices = computed((): PieSlice[] => {
  const r = results.value;
  const locale = currentLocale.value;

  const furusatoEntry = deductionEntries.value.find(e => e.type === 'furusato');
  const furusatoDonation = furusatoEntry ? getCashCost(furusatoEntry, idecoMonthlyLimit.value) : 0;
  const idecoAmount = totalCashCost.value - furusatoDonation;

  return [
    {
      label: locale === 'ja' ? '健康保険・介護保険' : 'Health & Nursing Care',
      value: r.healthInsurance + r.kaigoInsurance,
      color: '#6fcfad',
    },
    {
      label: locale === 'ja' ? '国民健康保険' : 'National Health Insurance',
      value: r.nationalHealthInsurance,
      color: '#6fcfad',
    },
    {
      label: locale === 'ja' ? '厚生年金' : 'Pension',
      value: r.pension,
      color: '#3b82f6',
    },
    {
      label: locale === 'ja' ? '国民年金' : 'National Pension',
      value: r.nationalPension,
      color: '#60a5fa',
    },
    {
      label: locale === 'ja' ? '雇用保険' : 'Employment Insurance',
      value: r.employmentInsurance,
      color: '#14b8a6',
    },
    {
      label: locale === 'ja' ? '所得税' : 'Income Tax',
      value: r.incomeTax,
      color: '#f59e0b',
    },
    {
      label: locale === 'ja' ? '住民税' : 'Resident Tax',
      value: r.residentTax,
      color: '#a78bfa',
    },
    {
      label: locale === 'ja' ? 'iDeCo等掛金' : 'iDeCo Contributions',
      value: idecoAmount,
      color: '#fb923c',
    },
    {
      label: locale === 'ja' ? 'ふるさと納税 寄附金' : 'Furusato Donations',
      value: furusatoDonation,
      color: '#e879a0',
    },
    {
      label: locale === 'ja' ? '手取り' : 'Take-home',
      value: Math.max(0, r.netPay - totalCashCost.value),
      color: '#22223b',
    },
  ];
});
</script>

<template>
  <UApp>
  <div class="app-container">

    <UButton variant="outline" size="sm" color="neutral" class="lang-toggle fixed top-5 right-6 z-[1000] rounded-full shadow-sm" @click="currentLocale = (currentLocale === 'en' ? 'ja' : 'en')">
      {{ currentLocale === 'en' ? '日本語' : 'English' }}
    </UButton>

    <!-- Input Panel -->
    <div class="panel input-panel">
      <div class="input-section location-section" style="margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #eaeaea;">
        <div class="section-header">
          <h2>{{ t.locationSettings }}</h2>
          <UButton variant="outline" size="sm" color="error" class="reset-btn rounded-full" @click="resetState">{{ currentLocale === 'ja' ? 'リセット' : 'Reset' }}</UButton>
        </div>

        <div class="si-toggle" style="margin-bottom: 1rem;">
          <USwitch v-model="enrolledEmployeeSI" />
          <span>{{ t.enrolledEmployeeSI }}</span>
        </div>

        <div class="input-group">
          <label>{{ t.ageGroup }}</label>
          <USelect v-model="ageGroup" :items="ageGroupItems" class="styled-select" />
        </div>

        <div class="input-group" v-if="enrolledEmployeeSI">
          <label>{{ t.empPrefecture }}</label>
          <USelect v-model="employmentPrefecture" :items="prefectureItems" class="styled-select" />
        </div>

        <div class="input-group">
          <label>{{ t.resPrefecture }}</label>
          <USelect v-model="residencePrefecture" :items="prefectureItems" class="styled-select" @update:model-value="handleResidencePrefectureChange" />
        </div>

        <div class="input-group" v-if="availableCities.length > 0">
          <label>{{ t.municipality }}</label>
          <USelect v-model="residenceCity" :items="cityItems" class="styled-select" />
        </div>

        <div v-if="!enrolledEmployeeSI" class="nhi-section">
          <h3 style="margin: 1rem 0 0.5rem; font-size: 0.95rem; font-weight: 600;">{{ t.nationalHealthInsurance }}</h3>
          <UButtonGroup class="nhi-toggle-group">
            <UButton :variant="nhiMode === 'manual' ? 'solid' : 'outline'" size="sm" class="nhi-toggle-btn" @click="nhiMode = 'manual'">{{ t.nhiModeManual }}</UButton>
            <UButton :variant="nhiMode === 'auto' ? 'solid' : 'outline'" size="sm" class="nhi-toggle-btn" @click="nhiMode = 'auto'">{{ t.nhiModeAuto }}</UButton>
            <UButton :variant="nhiMode === 'municipality' ? 'solid' : 'outline'" size="sm" class="nhi-toggle-btn" :disabled="!municipalityAutoAvailable" @click="nhiMode = 'municipality'">{{ t.nhiModeCity }}</UButton>
          </UButtonGroup>

          <template v-if="nhiMode === 'manual'">
            <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.nhiTotalAmount }}</label>
            <UInput type="number" v-model.number="nhiManualAmount" :min="0" :step="1000">
              <template #leading><span class="text-base text-muted font-medium">¥</span></template>
            </UInput>
          </template>

          <template v-else-if="nhiMode === 'auto'">
            <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.nhiKintowari }}</label>
            <UInput type="number" v-model.number="nhiKintowari" :min="0" :step="100">
              <template #leading><span class="text-base text-muted font-medium">¥</span></template>
            </UInput>
            <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.nhiShotokuwari }}</label>
            <UInput type="number" v-model.number="nhiShotokuwariRate" :min="0" :step="0.01">
              <template #trailing><span class="text-sm text-muted">%</span></template>
            </UInput>
          </template>

          <template v-else-if="nhiMode === 'municipality' && municipalityNhiBreakdown">
            <div class="nhi-municipality-breakdown">
              <div v-if="municipalityNhiBreakdown.reduction > 0" class="nhi-breakdown-row nhi-breakdown-reduction">
                <span>{{ currentLocale === 'ja' ? '均等割軽減' : 'Per-capita Reduction' }}</span>
                <span>{{ municipalityNhiBreakdown.reduction * 100 }}%{{ currentLocale === 'ja' ? '軽減' : ' off' }}</span>
              </div>
              <div class="nhi-breakdown-row">
                <span>{{ currentLocale === 'ja' ? '医療分' : 'Medical' }}</span>
                <span>¥{{ municipalityNhiBreakdown.medical.toLocaleString() }}</span>
              </div>
              <div class="nhi-breakdown-row">
                <span>{{ currentLocale === 'ja' ? '支援金分' : 'Support' }}</span>
                <span>¥{{ municipalityNhiBreakdown.support.toLocaleString() }}</span>
              </div>
              <div class="nhi-breakdown-row" v-if="ageGroup === '40to64'">
                <span>{{ currentLocale === 'ja' ? '介護分' : 'Long-term Care' }}</span>
                <span>¥{{ municipalityNhiBreakdown.kaigo.toLocaleString() }}</span>
              </div>
              <div class="nhi-breakdown-row">
                <span>{{ currentLocale === 'ja' ? '子ども分' : 'Child Support' }}</span>
                <span>¥{{ municipalityNhiBreakdown.kodomo.toLocaleString() }}</span>
              </div>
              <div class="nhi-breakdown-row nhi-breakdown-total">
                <span>{{ currentLocale === 'ja' ? '合計' : 'Total' }}</span>
                <span>¥{{ municipalityNhiBreakdown.total.toLocaleString() }}</span>
              </div>
            </div>
          </template>
        </div>

        <template v-if="enrolledEmployeeSI">
          <UButton variant="ghost" size="sm" class="settings-toggle-btn" :icon="showAdvancedOptions ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" :label="showAdvancedOptions ? t.hideSettings : t.showSettings" @click="showAdvancedOptions = !showAdvancedOptions" style="margin-top: 0.5rem;" />

          <div v-show="showAdvancedOptions" class="advanced-options-panel">

            <div class="input-group">
              <label>{{ t.unionSelect }}</label>
              <USelect v-model="selectedKenpo" :items="kenpoItems" class="styled-select" @update:model-value="handleKenpoChange" />
            </div>

            <div class="input-group">
              <label>{{ t.customHealth }}</label>
              <UInput type="number" v-model.number="customHealthRate" :min="0" :step="0.01">
                <template #trailing><span class="text-sm text-muted">%</span></template>
              </UInput>
            </div>

            <div class="input-group">
              <label>{{ t.customKaigo }}</label>
              <UInput type="number" v-model.number="customKaigoRate" :min="0" :step="0.01">
                <template #trailing><span class="text-sm text-muted">%</span></template>
              </UInput>
            </div>

            <div class="input-group">
              <label>{{ t.customPension }}</label>
              <UInput type="number" v-model.number="customPensionRate" :min="0" :step="0.01">
                <template #trailing><span class="text-sm text-muted">%</span></template>
              </UInput>
            </div>

            <div class="input-group">
              <label>{{ t.employmentInsIndustry }}</label>
              <USelect v-model="selectedIndustry" :items="industryItems" class="styled-select" @update:model-value="handleIndustryChange" />
            </div>

            <div class="input-group">
              <label>{{ t.customEmploymentIns }}</label>
              <UInput type="number" v-model.number="customEmploymentInsRate" :min="0" :step="0.01">
                <template #trailing><span class="text-sm text-muted">%</span></template>
              </UInput>
            </div>

          </div>
        </template>
      </div>

      <div class="input-section">
        <h2>{{ t.incomeDetails }}</h2>

        <div class="card-list">
          <UCard v-for="entry in incomeEntries" :key="entry.id" :ui="{ header: 'py-2 px-3 bg-gray-50', body: 'p-3' }">
            <template #header>
              <div class="flex justify-between items-center">
                <span class="text-sm font-semibold">
                  {{ entry.type === 'salary' ? t.salaryIncomeName : t.businessIncomeName }}
                  <small v-if="entry.type === 'salary' && entry === primarySalaryEntry" class="bracket-info" style="margin-left: 0.4rem;">{{ t.primaryJob }}</small>
                  <UInput v-model="entry.name" size="xs" variant="ghost" class="name-input inline-block w-28 ml-1" :placeholder="currentLocale === 'ja' ? '名称（任意）' : 'Name (optional)'" />
                </span>
                <UButton variant="ghost" size="xs" color="error" class="remove-btn" icon="i-lucide-x" @click="removeIncomeEntry(entry.id)" :title="t.removeIncome" />
              </div>
            </template>
            <!-- Salary inputs -->
            <template v-if="entry.type === 'salary'">
              <label class="deduction-input-label">{{ t.monthlySalary }}</label>
              <UInput type="number" v-model.number="entry.monthlySalary" :min="0" :step="1000">
                <template #leading><span class="text-base text-muted font-medium">¥</span></template>
              </UInput>
              <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.annualBonus }}</label>
              <UInput type="number" v-model.number="entry.annualBonus" :min="0" :step="1000">
                <template #leading><span class="text-base text-muted font-medium">¥</span></template>
              </UInput>
              <div class="si-toggle" style="margin-top: 0.6rem;" v-if="entry === primarySalaryEntry">
                <USwitch v-model="entry.joinsEmploymentInsurance" />
                <span>
                  {{ t.joinsEmploymentInsurance }}
                  <UTooltip :content="{ side: 'bottom' }" :ui="{ content: 'h-auto bg-white text-gray-900 border border-gray-200 shadow-lg rounded-lg p-0 max-w-xs' }">
                    <template #content>
                      <div class="text-xs leading-relaxed" style="padding: 1rem;" v-if="currentLocale === 'ja'">
                        次の<b>(1)および(2)の両方</b>に該当する場合、雇用保険に加入する必要があります。<br/><br/>
                        <b>(1) 31日以上継続して雇用される見込みがあること</b><br/>
                        ・期間の定めなく雇用される場合<br/>
                        ・雇用期間が31日以上の場合<br/>
                        ・契約に更新規定があり、31日未満での雇止め明示がない場合<br/><br/>
                        <b>(2) 1週間の所定労働時間が20時間以上であること</b>
                      </div>
                      <div class="text-xs leading-relaxed" style="padding: 1rem;" v-else>
                        Employment insurance is required when <b>both</b> of the following apply:<br/><br/>
                        <b>(1) Expected to be employed continuously for 31+ days</b><br/>
                        · No fixed term<br/>
                        · Contract of 31+ days<br/>
                        · Contract has renewal clause with no explicit non-renewal before 31 days<br/><br/>
                        <b>(2) Scheduled weekly hours are 20 or more</b>
                      </div>
                    </template>
                    <span class="inline-flex items-center justify-center w-4 h-4 text-[0.65rem] font-bold text-gray-500 bg-gray-100 rounded-full cursor-help ml-1">?</span>
                  </UTooltip>
                </span>
              </div>
              <div class="si-toggle" style="margin-top: 0.6rem;">
                <USwitch v-model="entry.joinsSocialInsurance" />
                <span>
                  {{ t.joinsSocialInsurance }}
                  <UTooltip :content="{ side: 'bottom' }" :ui="{ content: 'h-auto bg-white text-gray-900 border border-gray-200 shadow-lg rounded-lg p-0 max-w-xs' }">
                    <template #content>
                      <div class="text-xs leading-relaxed" style="padding: 1rem;" v-if="currentLocale === 'ja'">
                        以下のいずれかに該当する場合、勤務先の社会保険に加入する必要があります。<br/><br/>
                        <b>① フルタイムの3/4以上</b><br/>
                        正社員の所定労働時間・日数の3/4以上勤務している場合<br/><br/>
                        <b>② 以下の5条件をすべて満たす場合</b><br/>
                        ・週の所定労働時間が20時間以上<br/>
                        ・所定内賃金が月額8.8万円以上（残業代・交通費・ボーナス除く）<br/>
                        ・雇用期間が2ヶ月超の見込み<br/>
                        ・昼間学生でないこと<br/>
                        ・従業員51人以上の企業であること
                      </div>
                      <div class="text-xs leading-relaxed" style="padding: 1rem;" v-else>
                        You must enroll in employer social insurance if either of the following applies:<br/><br/>
                        <b>1. Work 3/4+ of full-time hours and days</b><br/><br/>
                        <b>2. All five conditions are met:</b><br/>
                        - Weekly working hours: 20+ hours/week<br/>
                        - Monthly wage: ¥88,000+ (base pay only, excl. overtime, commuting, bonus)<br/>
                        - Employment period: expected to exceed 2 months<br/>
                        - Not a full-time student<br/>
                        - Employer has 51+ employees (pension-insured)
                      </div>
                    </template>
                    <span class="inline-flex items-center justify-center w-4 h-4 text-[0.65rem] font-bold text-gray-500 bg-gray-100 rounded-full cursor-help ml-1">?</span>
                  </UTooltip>
                </span>
              </div>
            </template>
            <!-- Business inputs -->
            <template v-else>
              <label class="deduction-input-label">{{ t.businessRevenue }}</label>
              <UInput type="number" v-model.number="entry.revenue" :min="0" :step="1000">
                <template #leading><span class="text-base text-muted font-medium">¥</span></template>
              </UInput>
              <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.businessExpenses }}</label>
              <UInput type="number" v-model.number="entry.expenses" :min="0" :step="1000">
                <template #leading><span class="text-base text-muted font-medium">¥</span></template>
              </UInput>
            </template>
          </UCard>
        </div>

        <div style="margin-top: 0.75rem;">
          <UDropdownMenu :items="incomePickerItems">
            <UButton variant="outline" size="sm" class="outline-btn" :label="t.addIncome" />
          </UDropdownMenu>
        </div>

        <div class="input-group" style="margin-top: 1rem;">
          <label>{{ t.prevIncome }}</label>
          <UInput type="number" v-model.number="previousYearIncomeInput" :min="0" :step="1000" :placeholder="t.prevIncomePlaceholder">
            <template #leading><span class="text-base text-muted font-medium">¥</span></template>
          </UInput>
        </div>
      </div>

      <!-- Deductions Section -->
      <div class="input-section deductions-section">
        <div class="deductions-header">
          <h2>{{ t.deductionsSection }}</h2>
          <UDropdownMenu :items="deductionPickerItems">
            <UButton variant="outline" size="sm" class="outline-btn" :label="t.addDeduction" />
          </UDropdownMenu>
        </div>

        <p class="no-deductions-msg" v-if="deductionEntries.length === 0">{{ t.noDeductions }}</p>

        <div class="card-list">
          <UCard v-for="entry in deductionEntries" :key="entry.id" :ui="{ header: 'py-2 px-3 bg-gray-50', body: 'p-3' }">
            <template #header>
              <div class="flex justify-between items-center">
                <span class="text-sm font-semibold flex items-center gap-1">
                  {{ currentLocale === 'ja' ? DEDUCTION_DEFS[entry.type].nameJa : DEDUCTION_DEFS[entry.type].nameEn }}
                  <UTooltip
                    v-if="entry.type === 'ideco'"
                    :content="{ side: 'bottom' }"
                    :ui="{ content: 'h-auto bg-white text-gray-900 border border-gray-200 shadow-lg rounded-lg p-0' }"
                  >
                    <template #content>
                      <div style="padding: 1rem; min-width: 220px;">
                        <div style="font-weight: 600; margin-bottom: 0.6rem; font-size: 0.8rem;">{{ t.idecoLimitTooltipTitle }}</div>
                        <div
                          v-for="row in t.idecoLimitTooltipRows"
                          :key="row.label"
                          style="display: flex; justify-content: space-between; gap: 1.5rem; font-size: 0.78rem; padding: 0.2rem 0; color: #444;"
                        >
                          <span>{{ row.label }}</span>
                          <span style="font-weight: 600; color: #111; white-space: nowrap;">{{ row.limit }}</span>
                        </div>
                      </div>
                    </template>
                    <span class="inline-flex items-center justify-center w-4 h-4 text-[0.65rem] font-bold text-gray-500 bg-gray-100 rounded-full cursor-help">?</span>
                  </UTooltip>
                </span>
                <div class="flex items-center gap-1">
                  <UButton v-if="entry.type === 'home_loan'" variant="outline" size="xs" class="outline-btn" :label="t.wizardEdit" @click="openHomeLoanEdit(entry.id)" />
                  <UButton variant="ghost" size="xs" color="error" class="remove-btn" icon="i-lucide-x" @click="removeDeduction(entry.id)" :title="t.removeDeduction" />
                </div>
              </div>
            </template>

            <!-- Home loan: show summary instead of input -->
            <template v-if="entry.type === 'home_loan' && entry.homeLoanParams">
              <div class="hl-summary-row">
                <span>{{ t.homeLoanMoveInYear }}</span>
                <span>{{ entry.homeLoanParams.moveInYear }}</span>
              </div>
              <div class="hl-summary-row">
                <span>{{ t.homeLoanYearEndBalance }}</span>
                <span>{{ formatCurrency(entry.homeLoanParams.yearEndBalance) }}</span>
              </div>
              <div class="hl-summary-row">
                <span>{{ t.homeLoanDeductionYear }}</span>
                <span>{{ entry.homeLoanParams.deductionYear }}{{ t.homeLoanDeductionYearSuffix }}</span>
              </div>
              <div class="deduction-computed">
                <span class="deduction-computed-label">{{ t.homeLoanEstimatedCredit }}</span>
                <span class="deduction-computed-value">{{ formatCurrency(entry.value) }}</span>
              </div>
              <a v-if="DEDUCTION_DEFS[entry.type].ntaUrl" class="nta-reference-link" :href="DEDUCTION_DEFS[entry.type].ntaUrl" target="_blank" rel="noopener noreferrer">{{ t.ntaReference }} ↗</a>
            </template>

            <!-- Standard deductions: input field -->
            <template v-else>
              <label class="deduction-input-label">
                {{ currentLocale === 'ja' ? DEDUCTION_DEFS[entry.type].inputLabelJa : DEDUCTION_DEFS[entry.type].inputLabelEn }}
              </label>
              <UInput type="number" v-model.number="entry.value" :min="0" :step="DEDUCTION_DEFS[entry.type].inputIsCount ? 1 : 1000">
                <template #leading v-if="!DEDUCTION_DEFS[entry.type].inputIsCount"><span class="text-base text-muted font-medium">¥</span></template>
              </UInput>
              <div class="deduction-computed">
                <span class="deduction-computed-label">{{ t.deductionAmount }}</span>
                <span class="deduction-computed-value">{{ formatCurrency(deductionAmountFor(entry)) }}</span>
              </div>
              <a v-if="entry.type === 'furusato'" class="furusato-sim-link" href="https://www.furusato-tax.jp/about/simulation" target="_blank" rel="noopener noreferrer">{{ currentLocale === 'ja' ? '控除上限額シミュレーション' : 'Calculate your max contribution' }} ↗</a>
              <a v-if="DEDUCTION_DEFS[entry.type].ntaUrl" class="nta-reference-link" :href="DEDUCTION_DEFS[entry.type].ntaUrl" target="_blank" rel="noopener noreferrer">{{ t.ntaReference }} ↗</a>
            </template>
          </UCard>
        </div>

        <div class="deduction-total" v-if="deductionEntries.length > 0">
          <span>{{ t.totalAdditionalDeductions }}</span>
          <span>{{ formatCurrency(totalAdditionalDeductions) }}</span>
        </div>
      </div>
    </div>

    <!-- Output Panel -->
    <div class="panel results-panel">
      <div class="results-card">
        <h2>{{ t.annualBreakdown }}</h2>
        
        <div class="result-row total-gross">
          <span>{{ t.grossIncome }}</span>
          <span>{{ formatCurrency(results.annualGross) }}</span>
        </div>
        <div class="result-row deduction sub-item">
          <span>└ {{ t.employmentIncomeDeduction }}</span>
          <span>- {{ formatCurrency(results.employmentIncomeDeduction) }}</span>
        </div>
        <div class="result-row sub-item employment-income-row">
          <span>= {{ t.employmentIncome }}</span>
          <span>{{ formatCurrency(results.employmentIncome) }}</span>
        </div>
        <div class="result-row sub-item" v-if="results.businessIncome > 0">
          <span>+ {{ t.businessIncomeName }}</span>
          <span>{{ formatCurrency(results.businessIncome) }}</span>
        </div>

        <div class="divider"></div>

        <!-- Single SI workplace -->
        <template v-if="!hasMultipleSiEntries">
          <div class="result-row deduction social-insurance-row" v-if="results.healthInsurance > 0">
            <span>{{ t.healthIns }} <small class="bracket-info">{{ t.gradeString }} {{ results.healthBracket }} ({{ formatCurrency(results.healthStandardRemuneration) }})</small></span>
            <span class="social-ins-value">- {{ formatCurrency(results.healthInsurance) }}</span>
          </div>
          <div class="result-row deduction social-insurance-row" v-if="results.kaigoInsurance > 0">
            <span>{{ t.nursingCare }}</span>
            <span class="social-ins-value">- {{ formatCurrency(results.kaigoInsurance) }}</span>
          </div>
          <div class="result-row deduction social-insurance-row" v-if="results.pension > 0">
            <span>{{ t.pension }} <small class="bracket-info">{{ t.gradeString }} {{ results.pensionBracket }} ({{ formatCurrency(results.pensionStandardRemuneration) }})</small></span>
            <span class="social-ins-value">- {{ formatCurrency(results.pension) }}</span>
          </div>
        </template>

        <!-- Multiple SI workplaces -->
        <template v-else>
          <template v-for="si in siBreakdown" :key="si.entryId + '-health'">
            <div class="result-row deduction social-insurance-row" v-if="si.annualHealth > 0">
              <span>{{ t.healthIns }} <small class="bracket-info">{{ si.label }} — {{ t.gradeString }} {{ si.healthBracket }} ({{ formatCurrency(si.healthStandardRemuneration) }})</small></span>
              <span class="social-ins-value">- {{ formatCurrency(si.annualHealth) }}</span>
            </div>
            <div class="result-row deduction social-insurance-row" v-if="si.annualKaigo > 0">
              <span>{{ t.nursingCare }} <small class="bracket-info">{{ si.label }}</small></span>
              <span class="social-ins-value">- {{ formatCurrency(si.annualKaigo) }}</span>
            </div>
            <div class="result-row deduction social-insurance-row" v-if="si.annualPension > 0">
              <span>{{ t.pension }} <small class="bracket-info">{{ si.label }} — {{ t.gradeString }} {{ si.pensionBracket }} ({{ formatCurrency(si.pensionStandardRemuneration) }})</small></span>
              <span class="social-ins-value">- {{ formatCurrency(si.annualPension) }}</span>
            </div>
          </template>
        </template>

        <!-- National Pension (when not in 厚生年金) -->
        <div class="result-row deduction social-insurance-row" v-if="!enrolledEmployeeSI">
          <span>
            {{ t.nationalPension }}
            <span v-if="pensionResult.exemptionTier !== 'none'" class="pension-exemption-badge">
              {{ pensionResult.exemptionTier === 'full'
                  ? (currentLocale === 'ja' ? '全額免除' : 'Full Exemption')
                  : (currentLocale === 'ja' ? `${pensionResult.exemptionTier}免除` : `${pensionResult.exemptionTier} Exempt`) }}
            </span>
          </span>
          <span class="social-ins-value">- {{ formatCurrency(results.nationalPension) }}</span>
        </div>

        <div class="result-row deduction social-insurance-row" v-if="results.nationalHealthInsurance > 0">
          <span>{{ t.nationalHealthInsurance }}</span>
          <span class="social-ins-value">- {{ formatCurrency(results.nationalHealthInsurance) }}</span>
        </div>

        <div class="result-row deduction social-insurance-row" v-if="results.employmentInsurance > 0">
          <span>{{ t.employmentIns }}</span>
          <span class="social-ins-value">- {{ formatCurrency(results.employmentInsurance) }}</span>
        </div>
        <div class="result-row deduction">
          <span>{{ t.basicExemption }}</span>
          <span>- {{ formatCurrency(results.basicExemption) }}</span>
        </div>

        <template v-if="deductionEntries.length > 0">
          <template v-for="entry in deductionEntries" :key="entry.id">
            <div
              v-if="!DEDUCTION_DEFS[entry.type].isTaxCredit"
              class="result-row deduction user-deduction-row"
            >
              <span>
                {{ currentLocale === 'ja' ? DEDUCTION_DEFS[entry.type].nameJa : DEDUCTION_DEFS[entry.type].nameEn }}
              </span>
              <span>- {{ formatCurrency(deductionAmountFor(entry)) }}</span>
            </div>
          </template>
        </template>

        <div class="divider"></div>

        <div class="result-row taxable-income-row">
          <span>
            {{ t.taxableIncome }}
          </span>
          <span class="taxable-income-value">{{ formatCurrency(results.taxableIncome) }}</span>
        </div>

        <div class="divider"></div>

        <div class="result-row deduction">
          <span>
            {{ t.incomeTax }}
            <span class="bracket-info marginal-rate-badge" :title="t.marginalRateSurtax + ': ' + results.effectiveMarginalRate + '%'">
              {{ results.marginalRate }}% <span class="marginal-surtax">({{ results.effectiveMarginalRate }}%)</span>
            </span>
          </span>
          <span>- {{ formatCurrency(results.incomeTax) }}</span>
        </div>
        <div class="result-row deduction sub-item furusato-credit-row" v-if="results.furusatoIncomeTaxCredit > 0">
          <span>✓ {{ t.furusatoIncomeTaxCredit }}</span>
          <span class="furusato-credit-value">+ {{ formatCurrency(results.furusatoIncomeTaxCredit) }}</span>
        </div>
        <div class="result-row deduction sub-item home-loan-credit-row" v-if="results.homeLoanIncomeTaxCredit > 0">
          <span>✓ {{ t.homeLoanIncomeTaxCredit }}</span>
          <span class="home-loan-credit-value">+ {{ formatCurrency(results.homeLoanIncomeTaxCredit) }}</span>
        </div>

        <div class="result-row deduction">
          <span>{{ t.residentTax }}</span>
          <span>- {{ formatCurrency(results.residentTax) }}</span>
        </div>
        <div class="result-row deduction sub-item furusato-credit-row" v-if="results.furusatoResidentTaxCredit > 0">
          <span>✓ {{ t.furusatoResidentTaxCredit }}</span>
          <span class="furusato-credit-value">+ {{ formatCurrency(results.furusatoResidentTaxCredit) }}</span>
        </div>
        <div class="result-row deduction sub-item home-loan-credit-row" v-if="results.homeLoanResidentTaxCredit > 0">
          <span>✓ {{ t.homeLoanResidentTaxCredit }}</span>
          <span class="home-loan-credit-value">+ {{ formatCurrency(results.homeLoanResidentTaxCredit) }}</span>
        </div>
        <div class="result-row deduction sub-item">
          <span>└ {{ t.residentPref }}</span>
          <span>- {{ formatCurrency(results.residentTaxPrefectural) }}</span>
        </div>
        <div class="result-row deduction sub-item">
          <span>└ {{ t.residentMuni }}</span>
          <span>- {{ formatCurrency(results.residentTaxMunicipal) }}</span>
        </div>

        <div class="result-row total-deductions">
          <span>{{ t.totalDeductions }}</span>
          <span>- {{ formatCurrency(results.totalDeductions) }}</span>
        </div>

        <div class="divider"></div>

        <div class="result-row net-pay highlight">
          <span>{{ t.netPay }}</span>
          <span class="net-value">{{ formatCurrency(results.netPay) }}</span>
        </div>

        <template v-if="totalCashCost > 0">
          <div
            class="result-row deduction cash-cost-row"
            v-for="entry in cashCostEntries"
            :key="'cc-' + entry.id"
          >
            <span>
              {{ currentLocale === 'ja' ? DEDUCTION_DEFS[entry.type].nameJa : DEDUCTION_DEFS[entry.type].nameEn }}
              <small class="cash-cost-tag">{{ t.cashCostContributions }}</small>
            </span>
            <span>- {{ formatCurrency(getCashCost(entry, idecoMonthlyLimit)) }}</span>
          </div>

          <div class="divider"></div>

          <div class="result-row disposable-income-row">
            <span>
              {{ t.disposableIncome }}
              <small class="taxable-income-sub">{{ t.disposableIncomeSub }}</small>
            </span>
            <span class="net-value">{{ formatCurrency(results.netPay - totalCashCost) }}</span>
          </div>
        </template>

        <div class="estimated-monthly">
          {{ t.monthlyPay }}: <strong>{{ formatCurrency(hasSalaryIncome ? results.monthlyNet - totalCashCost / 12 : (results.netPay - totalCashCost) / 12) }}</strong>
          <br/>
          <span v-if="hasSalaryIncome && results.annualGross - results.monthlyNet*12 > 0">{{ t.bonusPay }}: <strong>{{ formatCurrency(results.bonusNet) }}</strong></span>
        </div>
      </div>
    </div>

    <!-- Home Loan Wizard Modal -->
    <HomeLoanWizard
      v-if="showHomeLoanWizard"
      :t="t"
      :locale="currentLocale"
      :initial="editingHomeLoanId ? (deductionEntries.find(e => e.id === editingHomeLoanId)?.homeLoanParams ?? null) : null"
      @confirm="handleHomeLoanConfirm"
      @cancel="showHomeLoanWizard = false; editingHomeLoanId = null"
    />

    <!-- Visualization Panel -->
    <div class="panel viz-panel">
      <h2 class="viz-title">{{ currentLocale === 'ja' ? '年収の内訳' : 'Income Breakdown' }}</h2>
      <p class="viz-sub">{{ currentLocale === 'ja' ? '年間の給与控除割合' : 'Annual gross income allocation' }}</p>
      <DonutChart
        :slices="pieSlices"
        :center-label="formatCurrency(results.annualGross)"
        :center-sub="currentLocale === 'ja' ? '年収' : 'Gross'"
      />
    </div>
  </div>
  </UApp>
</template>

<style scoped>
/* Layout */
.app-container {
  height: 100vh;
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
  background-color: #fafafa;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #111;
  box-sizing: border-box;
  overflow: hidden;
}

.panel {
  background: #ffffff;
  border-right: 1px solid #eaeaea;
  padding: 3rem;
  overflow-y: auto;
  flex-shrink: 0;
}

.input-panel {
  width: 100%;
  max-width: 480px;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.02);
  z-index: 2;
}

.results-panel {
  width: 100%;
  max-width: 480px;
  background: #fdfdfd;
  box-shadow: 4px 0 12px rgba(0, 0, 0, 0.01);
  z-index: 1;
}

.viz-panel {
  flex: 1 1 0;
  min-width: 280px;
  background: #fafafa;
  border-right: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 3rem 2rem;
  overflow-y: auto;
}

.viz-panel > * {
  width: 100%;
  max-width: 340px;
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

/* Section headers */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-header h2 {
  margin-bottom: 0;
}

.input-section h2, .results-card h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #111;
  margin-bottom: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
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

.input-group small {
  color: #888 !important;
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

.deduction {
  color: #555;
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

.marginal-rate-badge {
  background-color: #edf2ff;
  color: #3b5bdb;
  cursor: default;
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
.nhi-breakdown-row {
  display: flex;
  justify-content: space-between;
  padding: 0.35rem 0.7rem;
  border-bottom: 1px solid #f0f0f0;
  color: #555;
}
.nhi-breakdown-row:last-child {
  border-bottom: none;
}
.nhi-breakdown-total {
  font-weight: 600;
  color: #111;
  background: #f7f7f7;
}
.nhi-breakdown-reduction {
  color: #2e7d32;
  background: #f1f8f1;
  font-size: 0.82rem;
  font-weight: 500;
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
