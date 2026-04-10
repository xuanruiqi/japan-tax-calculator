<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { calculateTaxesAndInsurance, getStandardRemunerationGrade } from './utils/taxCalculation';
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
  joinsSocialInsurance: boolean;  // salary only — whether health/pension is enrolled at this workplace
}

const incomeEntries = ref<IncomeEntry[]>([
  { id: 'salary-default', type: 'salary', name: '', monthlySalary: 300000, annualBonus: 0, revenue: null, expenses: null, joinsSocialInsurance: true },
]);
const showIncomePicker = ref(false);

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
  });
  showIncomePicker.value = false;
};

const removeIncomeEntry = (id: string) => {
  incomeEntries.value = incomeEntries.value.filter(e => e.id !== id);
};

// Derived values for calculation — primary salary is the first salary entry
const primarySalaryEntry = computed(() => incomeEntries.value.find(e => e.type === 'salary'));
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

type KenpoType = 'kyokai' | 'its' | 'tjk' | 'other';
const selectedKenpo = ref<KenpoType>('kyokai');

type AgeGroupType = 'under40' | '40to64' | '65over';
const ageGroup = ref<AgeGroupType>('under40');

const enrolledEmployeeSI = ref<boolean>(true);

const tooltipStyle = ref<Record<string, string>>({});
const showTooltip = ref(false);
const onTooltipEnter = (e: MouseEvent) => {
  const el = e.currentTarget as HTMLElement;
  const rect = el.getBoundingClientRect();
  tooltipStyle.value = {
    top: `${rect.bottom + 8}px`,
    left: `${Math.min(rect.left, window.innerWidth - 340)}px`,
  };
  showTooltip.value = true;
};
const onTooltipLeave = () => {
  showTooltip.value = false;
};

type NhiMode = 'manual' | 'auto';
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
    { id: 'salary-default', type: 'salary', name: '', monthlySalary: 300000, annualBonus: 0, revenue: null, expenses: null, joinsSocialInsurance: true },
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

const showDeductionPicker = ref(false);

const onClickOutsidePicker = () => {
  showIncomePicker.value = false;
  showDeductionPicker.value = false;
};

onMounted(() => document.addEventListener('click', onClickOutsidePicker));
onUnmounted(() => document.removeEventListener('click', onClickOutsidePicker));

const showHomeLoanWizard = ref(false);
const editingHomeLoanId = ref<string | null>(null);

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
    .reduce((sum, entry) => sum + calculateDeductionAmount(entry.type, entry.value, gross), 0);
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
    showDeductionPicker.value = false;
    return;
  }
  deductionEntries.value.push({
    id: `${type}-${Date.now()}`,
    type,
    value: DEDUCTION_DEFS[type].inputIsCount ? 1 : 0,
  });
  showDeductionPicker.value = false;
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
  return calculateDeductionAmount(entry.type, entry.value, salaryGross + bizIncome);
};

const totalCashCost = computed(() =>
  deductionEntries.value.reduce((sum, e) => sum + getCashCost(e), 0)
);

const cashCostEntries = computed(() =>
  deductionEntries.value.filter(e => getCashCost(e) > 0)
);

// Compute NHI amount (only relevant when not in employee SI)
const nhiAmount = computed(() => {
  if (enrolledEmployeeSI.value) return 0;
  if (nhiMode.value === 'manual') {
    return Math.max(0, Number(nhiManualAmount.value) || 0);
  }
  // Auto mode: 所得割 + 均等割
  // NHI base = max(0, total income - 基礎控除 430,000)
  const salaryGross = incomeEntries.value
    .filter(e => e.type === 'salary')
    .reduce((sum, e) => sum + (Number(e.monthlySalary) || 0) * 12 + (Number(e.annualBonus) || 0), 0);
  // Compute employment income deduction for NHI base
  let empDeduction = 0;
  if (salaryGross <= 1625000) empDeduction = Math.min(salaryGross, 550000);
  else if (salaryGross <= 1800000) empDeduction = salaryGross * 0.4 - 100000;
  else if (salaryGross <= 3600000) empDeduction = salaryGross * 0.3 + 80000;
  else if (salaryGross <= 6600000) empDeduction = salaryGross * 0.2 + 440000;
  else if (salaryGross <= 8500000) empDeduction = salaryGross * 0.1 + 1100000;
  else empDeduction = 1950000;
  const empIncome = Math.max(0, salaryGross - empDeduction);
  const bizIncome = incomeEntries.value
    .filter(e => e.type === 'business')
    .reduce((sum, e) => sum + Math.max(0, (Number(e.revenue) || 0) - (Number(e.expenses) || 0)), 0);
  const totalIncome = empIncome + bizIncome;
  const nhiBase = Math.max(0, totalIncome - 430000);
  const shotokuwari = Math.floor(nhiBase * (Number(nhiShotokuwariRate.value) || 0) / 100);
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

  // Social insurance from non-primary workplaces that have SI joined
  let additionalHealthInsurance = 0;
  let additionalKaigoInsurance = 0;
  let additionalPension = 0;
  for (const entry of nonPrimaryEntries) {
    if (!entry.joinsSocialInsurance) continue;
    const ms = Number(entry.monthlySalary) || 0;
    const ab = Number(entry.annualBonus) || 0;
    const hObj = getStandardRemunerationGrade(ms, 1390000);
    const pObj = getStandardRemunerationGrade(ms, 650000);
    const bonusStdH = Math.min(Math.floor(ab / 1000) * 1000, 5730000);
    const bonusStdP = Math.min(Math.floor(ab / 1000) * 1000, 1500000);
    additionalHealthInsurance += Math.floor(hObj.value * hRate) * 12 + Math.floor(bonusStdH * hRate);
    additionalKaigoInsurance += Math.floor(hObj.value * kRate) * 12 + Math.floor(bonusStdH * kRate);
    additionalPension += Math.floor(pObj.value * pRate) * 12 + Math.floor(bonusStdP * pRate);
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
    nationalPensionAmount: globalSI ? 0 : 17920 * 12,
    nationalHealthInsuranceAmount: globalSI ? 0 : nhiAmount.value,
    employmentInsuranceRate: eRate,
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
  const furusatoDonation = furusatoEntry ? getCashCost(furusatoEntry) : 0;
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
  <div class="app-container">
    
    <button class="top-btn top-right-btn" @click="currentLocale = (currentLocale === 'en' ? 'ja' : 'en')">
      {{ currentLocale === 'en' ? '日本語' : 'English' }}
    </button>

    <!-- Input Panel -->
    <div class="panel input-panel">
      <div class="input-section location-section" style="margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #eaeaea;">
        <div class="section-header">
          <h2>{{ t.locationSettings }}</h2>
          <button class="top-btn reset-btn" @click="resetState">{{ currentLocale === 'ja' ? 'リセット' : 'Reset' }}</button>
        </div>

        <label class="si-toggle" style="margin-bottom: 1rem;">
          <span class="switch">
            <input type="checkbox" v-model="enrolledEmployeeSI" />
            <span class="switch-slider"></span>
          </span>
          <span>{{ t.enrolledEmployeeSI }}</span>
        </label>

        <div class="input-group">
          <label for="ageGroup">{{ t.ageGroup }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.ageGroupSub }}</small></label>
          <div class="input-wrapper">
            <select id="ageGroup" v-model="ageGroup" class="styled-select">
              <option value="under40">{{ t.ageUnder40 }}</option>
              <option value="40to64">{{ t.age40to64 }}</option>
              <option value="65over">{{ t.age65over }}</option>
            </select>
          </div>
        </div>

        <div class="input-group" v-if="enrolledEmployeeSI">
          <label for="employmentPrefecture">{{ t.empPrefecture }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.empPrefectureSub }}</small></label>
          <div class="input-wrapper">
            <select id="employmentPrefecture" v-model="employmentPrefecture" class="styled-select">
              <option v-for="pref in PREFECTURES_LIST" :key="'emp-'+pref" :value="pref">{{ prefName(pref) }}</option>
            </select>
          </div>
        </div>

        <div class="input-group">
          <label for="residencePrefecture">{{ t.resPrefecture }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.resPrefectureSub }}</small></label>
          <div class="input-wrapper">
            <select id="residencePrefecture" v-model="residencePrefecture" @change="handleResidencePrefectureChange" class="styled-select">
              <option v-for="pref in PREFECTURES_LIST" :key="'res-'+pref" :value="pref">{{ prefName(pref) }}</option>
            </select>
          </div>
        </div>

        <div class="input-group" v-if="availableCities.length > 0">
          <label for="residenceCity">{{ t.municipality }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.municipalitySub }}</small></label>
          <div class="input-wrapper">
            <select id="residenceCity" v-model="residenceCity" class="styled-select">
              <option value="standard">{{ t.standardCity }}</option>
              <option v-for="city in availableCities" :key="city" :value="city">{{ cityName(city) }}</option>
            </select>
          </div>
        </div>

        <div v-if="!enrolledEmployeeSI" class="nhi-section">
          <h3 style="margin: 1rem 0 0.5rem; font-size: 0.95rem; font-weight: 600;">{{ t.nationalHealthInsurance }}</h3>
          <div class="nhi-mode-toggle">
            <button :class="['nhi-mode-btn', { active: nhiMode === 'manual' }]" @click="nhiMode = 'manual'">{{ t.nhiModeManual }}</button>
            <button :class="['nhi-mode-btn', { active: nhiMode === 'auto' }]" @click="nhiMode = 'auto'">{{ t.nhiModeAuto }}</button>
          </div>

          <template v-if="nhiMode === 'manual'">
            <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.nhiTotalAmount }}</label>
            <div class="input-wrapper has-currency">
              <span class="currency-symbol">¥</span>
              <input type="number" v-model.number="nhiManualAmount" min="0" step="1000" class="deduction-input" />
            </div>
          </template>

          <template v-else>
            <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.nhiKintowari }}</label>
            <div class="input-wrapper has-currency">
              <span class="currency-symbol">¥</span>
              <input type="number" v-model.number="nhiKintowari" min="0" step="100" class="deduction-input" />
            </div>
            <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.nhiShotokuwari }}</label>
            <div class="input-wrapper has-percentage">
              <input type="number" v-model.number="nhiShotokuwariRate" min="0" step="0.01" class="deduction-input" />
              <span class="percentage-symbol">%</span>
            </div>
          </template>
        </div>

        <template v-if="enrolledEmployeeSI">
          <div class="advanced-options-toggle" @click="showAdvancedOptions = !showAdvancedOptions">
            <span>{{ showAdvancedOptions ? '▼ ' + t.hideSettings : '▶ ' + t.showSettings }}</span>
          </div>

          <div v-show="showAdvancedOptions" class="advanced-options-panel">

            <div class="input-group">
              <label for="kenpoSelect">{{ t.unionSelect }}</label>
              <div class="input-wrapper">
                <select id="kenpoSelect" v-model="selectedKenpo" @change="handleKenpoChange" class="styled-select">
                  <option value="kyokai">{{ t.unionKyokai }}</option>
                  <option value="its">{{ t.unionIts }}</option>
                  <option value="tjk">{{ t.unionTjk }}</option>
                  <option value="other">{{ t.unionOther }}</option>
                </select>
              </div>
            </div>

            <div class="input-group">
              <label for="customHealthRate">{{ t.customHealth }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.customHealthSub }}</small></label>
              <div class="input-wrapper has-percentage">
                <input id="customHealthRate" type="number" v-model.number="customHealthRate" min="0" step="0.01" />
                <span class="percentage-symbol">%</span>
              </div>
            </div>

            <div class="input-group">
              <label for="customKaigoRate">{{ t.customKaigo }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.customKaigoSub }}</small></label>
              <div class="input-wrapper has-percentage">
                <input id="customKaigoRate" type="number" v-model.number="customKaigoRate" min="0" step="0.01" />
                <span class="percentage-symbol">%</span>
              </div>
            </div>

            <div class="input-group">
              <label for="customPensionRate">{{ t.customPension }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.customPensionSub }}</small></label>
              <div class="input-wrapper has-percentage">
                <input id="customPensionRate" type="number" v-model.number="customPensionRate" min="0" step="0.01" />
                <span class="percentage-symbol">%</span>
              </div>
            </div>

            <div class="input-group">
              <label for="industrySelect">{{ t.employmentInsIndustry }}</label>
              <div class="input-wrapper">
                <select id="industrySelect" v-model="selectedIndustry" @change="handleIndustryChange" class="styled-select">
                  <option value="general">{{ t.industryGeneral }}</option>
                  <option value="agriForestry">{{ t.industryAgriForestry }}</option>
                  <option value="construction">{{ t.industryConstruction }}</option>
                </select>
              </div>
            </div>

            <div class="input-group">
              <label for="customEmploymentInsRate">{{ t.customEmploymentIns }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.customEmploymentInsSub }}</small></label>
              <div class="input-wrapper has-percentage">
                <input id="customEmploymentInsRate" type="number" v-model.number="customEmploymentInsRate" min="0" step="0.01" />
                <span class="percentage-symbol">%</span>
              </div>
            </div>

          </div>
        </template>
      </div>

      <div class="input-section">
        <h2>{{ t.incomeDetails }}</h2>

        <div class="deduction-cards">
          <div class="deduction-card" v-for="entry in incomeEntries" :key="entry.id">
            <div class="deduction-card-header">
              <span class="deduction-card-name">
                {{ entry.type === 'salary' ? t.salaryIncomeName : t.businessIncomeName }}
                <small v-if="entry.type === 'salary' && entry === primarySalaryEntry" class="bracket-info" style="margin-left: 0.4rem;">{{ t.primaryJob }}</small>
                <input style="margin-left: 0.4rem;"
                  type="text"
                  v-model="entry.name"
                  class="income-name-input"
                  :placeholder="currentLocale === 'ja' ? '名称（任意）' : 'Name (optional)'"
                />
              </span>
              <div class="deduction-card-actions">
                <button class="remove-btn" @click="removeIncomeEntry(entry.id)" :title="t.removeIncome">✕</button>
              </div>
            </div>
            <div class="deduction-card-body">
              <!-- Salary inputs -->
              <template v-if="entry.type === 'salary'">
                <label class="deduction-input-label">{{ t.monthlySalary }}</label>
                <div class="input-wrapper has-currency">
                  <span class="currency-symbol">¥</span>
                  <input type="number" v-model.number="entry.monthlySalary" min="0" step="1000" class="deduction-input" />
                </div>
                <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.annualBonus }}</label>
                <div class="input-wrapper has-currency">
                  <span class="currency-symbol">¥</span>
                  <input type="number" v-model.number="entry.annualBonus" min="0" step="1000" class="deduction-input" />
                </div>
                <label class="si-toggle" style="margin-top: 0.6rem;">
                  <span class="switch">
                    <input type="checkbox" v-model="entry.joinsSocialInsurance" />
                    <span class="switch-slider"></span>
                  </span>
                  <span class="si-toggle-label">
                    {{ t.joinsSocialInsurance }}
                    <span class="tooltip-trigger" @mouseenter="onTooltipEnter" @mouseleave="onTooltipLeave">?</span>
                  </span>
                </label>
              </template>
              <!-- Business inputs -->
              <template v-else>
                <label class="deduction-input-label">{{ t.businessRevenue }}</label>
                <div class="input-wrapper has-currency">
                  <span class="currency-symbol">¥</span>
                  <input type="number" v-model.number="entry.revenue" min="0" step="1000" class="deduction-input" />
                </div>
                <label class="deduction-input-label" style="margin-top: 0.5rem;">{{ t.businessExpenses }}</label>
                <div class="input-wrapper has-currency">
                  <span class="currency-symbol">¥</span>
                  <input type="number" v-model.number="entry.expenses" min="0" step="1000" class="deduction-input" />
                </div>
              </template>
            </div>
          </div>
        </div>

        <div class="deduction-add-wrapper" style="margin-top: 0.75rem;" @click.stop>
          <button class="add-deduction-btn" @click="showIncomePicker = !showIncomePicker">{{ t.addIncome }}</button>
          <div v-if="showIncomePicker" class="deduction-picker">
            <button class="picker-item" @click="addIncomeEntry('salary')">
              <span class="picker-name">{{ t.salaryIncomeName }}</span>
              <small class="picker-desc">{{ t.salaryIncomeDesc }}</small>
            </button>
            <button class="picker-item" @click="addIncomeEntry('business')">
              <span class="picker-name">{{ t.businessIncomeName }}</span>
              <small class="picker-desc">{{ t.businessIncomeDesc }}</small>
            </button>
          </div>
        </div>

        <div class="input-group" style="margin-top: 1rem;">
          <label for="previousYearIncome">{{ t.prevIncome }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.prevIncomeSub }}</small></label>
          <div class="input-wrapper has-currency">
            <span class="currency-symbol">¥</span>
            <input
              id="previousYearIncome"
              type="number"
              v-model.number="previousYearIncomeInput"
              min="0"
              step="1000"
              :placeholder="t.prevIncomePlaceholder"
            />
          </div>
        </div>
      </div>

      <!-- Deductions Section -->
      <div class="input-section deductions-section">
        <div class="deductions-header">
          <h2>{{ t.deductionsSection }}</h2>
          <div class="deduction-add-wrapper" @click.stop>
            <button class="add-deduction-btn" @click="showDeductionPicker = !showDeductionPicker">
              {{ t.addDeduction }}
            </button>
            <div class="deduction-picker" v-if="showDeductionPicker && availableDeductionTypes.length > 0">
              <button
                v-for="type in availableDeductionTypes"
                :key="type"
                class="picker-item"
                @click="addDeduction(type)"
              >
                <span class="picker-name">{{ currentLocale === 'ja' ? DEDUCTION_DEFS[type].nameJa : DEDUCTION_DEFS[type].nameEn }}</span>
                <small class="picker-desc">{{ currentLocale === 'ja' ? DEDUCTION_DEFS[type].descJa : DEDUCTION_DEFS[type].descEn }}</small>
              </button>
            </div>
          </div>
        </div>

        <p class="no-deductions-msg" v-if="deductionEntries.length === 0">{{ t.noDeductions }}</p>

        <div class="deduction-cards">
          <div class="deduction-card" v-for="entry in deductionEntries" :key="entry.id">
            <div class="deduction-card-header">
              <span class="deduction-card-name">
                {{ currentLocale === 'ja' ? DEDUCTION_DEFS[entry.type].nameJa : DEDUCTION_DEFS[entry.type].nameEn }}
              </span>
              <div class="deduction-card-actions">
                <button v-if="entry.type === 'home_loan'" class="edit-btn" @click="openHomeLoanEdit(entry.id)">{{ t.wizardEdit }}</button>
                <button class="remove-btn" @click="removeDeduction(entry.id)" :title="t.removeDeduction">✕</button>
              </div>
            </div>

            <!-- Home loan: show summary instead of input -->
            <div v-if="entry.type === 'home_loan' && entry.homeLoanParams" class="deduction-card-body home-loan-summary">
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
              <a
                v-if="DEDUCTION_DEFS[entry.type].ntaUrl"
                class="nta-reference-link"
                :href="DEDUCTION_DEFS[entry.type].ntaUrl"
                target="_blank"
                rel="noopener noreferrer"
              >{{ t.ntaReference }} ↗</a>
            </div>

            <!-- Standard deductions: input field -->
            <div v-else class="deduction-card-body">
              <label class="deduction-input-label">
                {{ currentLocale === 'ja' ? DEDUCTION_DEFS[entry.type].inputLabelJa : DEDUCTION_DEFS[entry.type].inputLabelEn }}
              </label>
              <div class="input-wrapper" :class="DEDUCTION_DEFS[entry.type].inputIsCount ? '' : 'has-currency'">
                <span class="currency-symbol" v-if="!DEDUCTION_DEFS[entry.type].inputIsCount">¥</span>
                <input
                  type="number"
                  v-model.number="entry.value"
                  :min="0"
                  :step="DEDUCTION_DEFS[entry.type].inputIsCount ? 1 : 1000"
                  class="deduction-input"
                />
              </div>
              <div class="deduction-computed">
                <span class="deduction-computed-label">{{ t.deductionAmount }}</span>
                <span class="deduction-computed-value">{{ formatCurrency(deductionAmountFor(entry)) }}</span>
              </div>
              <a
                v-if="entry.type === 'furusato'"
                class="furusato-sim-link"
                href="https://www.furusato-tax.jp/about/simulation"
                target="_blank"
                rel="noopener noreferrer"
              >{{ currentLocale === 'ja' ? '控除上限額シミュレーション' : 'Calculate your max contribution' }} ↗</a>
              <a
                v-if="DEDUCTION_DEFS[entry.type].ntaUrl"
                class="nta-reference-link"
                :href="DEDUCTION_DEFS[entry.type].ntaUrl"
                target="_blank"
                rel="noopener noreferrer"
              >{{ t.ntaReference }} ↗</a>
            </div>
          </div>
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
        <div class="result-row deduction social-insurance-row" v-if="results.nationalPension > 0">
          <span>{{ t.nationalPension }}</span>
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
            <small class="taxable-income-sub">{{ t.taxableIncomeSub }}</small>
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
            <span>- {{ formatCurrency(getCashCost(entry)) }}</span>
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
          {{ t.monthlyPay }}: <strong>{{ formatCurrency(results.monthlyNet - totalCashCost / 12) }}</strong>
          <br/>
          <span v-if="results.annualGross - results.monthlyNet*12 > 0">{{ t.bonusPay }}: <strong>{{ formatCurrency(results.bonusNet) }}</strong></span>
          <span v-if="totalCashCost > 0" class="ideco-note">{{ t.disposableIncomeSub }}</span>
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
  <Teleport to="body">
    <div v-if="showTooltip" class="tooltip-content" :style="tooltipStyle">
      <template v-if="currentLocale === 'ja'">
        以下のいずれかに該当する場合、勤務先の社会保険に加入する必要があります。<br/><br/>
        <b>① フルタイムの3/4以上</b><br/>
        正社員の所定労働時間・日数の3/4以上勤務している場合<br/><br/>
        <b>② 以下の5条件をすべて満たす場合</b><br/>
        ・週の所定労働時間が20時間以上<br/>
        ・所定内賃金が月額8.8万円以上（残業代・交通費・ボーナス除く）<br/>
        ・雇用期間が2ヶ月超の見込み<br/>
        ・昼間学生でないこと<br/>
        ・従業員51人以上の企業であること
      </template>
      <template v-else>
        You must enroll in employer social insurance if either of the following applies:<br/><br/>
        <b>1. Work 3/4+ of full-time hours and days</b><br/><br/>
        <b>2. All five conditions are met:</b><br/>
        - Weekly working hours: 20+ hours/week<br/>
        - Monthly wage: ¥88,000+ (base pay only, excl. overtime, commuting, bonus)<br/>
        - Employment period: expected to exceed 2 months<br/>
        - Not a full-time student<br/>
        - Employer has 51+ employees (pension-insured)
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
/* Language toggle */
.top-btn {
  position: fixed;
  top: 1.25rem;
  z-index: 1000;
  padding: 0.4rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: #555;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 999px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, box-shadow 0.2s;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06);
}

.top-right-btn {
  right: 1.5rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-header h2 {
  margin-bottom: 0;
}

.reset-btn {
  position: static;
  color: #d32f2f;
  border-color: #d32f2f;
}

.top-btn.reset-btn:hover {
  color: #fff;
  background: #d32f2f;
  border-color: #d32f2f;
}

.top-btn:hover {
  color: #111;
  border-color: #111;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Minimalist, clean styling */
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


.input-section h2, .results-card h2 {
  font-size: 1.2rem;
  font-weight: 600;
  color: #111;
  margin-bottom: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

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

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  transition: border-color 0.2s;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #111;
}

/* Number input spinners hiding */
input[type=number]::-webkit-inner-spin-button, 
input[type=number]::-webkit-outer-spin-button { 
  -webkit-appearance: none; 
  margin: 0; 
}
input[type=number] {
  -moz-appearance: textfield;
}

.styled-select {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  transition: border-color 0.2s;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23333%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem top 50%;
  background-size: 0.65rem auto;
}

.styled-select:focus {
  outline: none;
  border-color: #111;
}

.currency-symbol {
  position: absolute;
  left: 1rem;
  font-size: 1rem;
  color: #888;
}

.percentage-symbol {
  position: absolute;
  right: 1rem;
  font-size: 1rem;
  color: #888;
}

.advanced-options-toggle {
  margin: 1.5rem 0 1rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: #666;
  cursor: pointer;
  user-select: none;
  display: inline-flex;
  align-items: center;
  transition: color 0.2s;
}

.advanced-options-toggle:hover {
  color: #111;
}

.advanced-options-panel {
  padding-top: 1.5rem;
  border-top: 1px dashed #eaeaea;
  margin-top: 0.5rem;
}

.has-currency input {
  padding-left: 2.2rem;
}

.has-percentage input {
  padding-right: 2.2rem;
}

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

/* ---- Deductions Section ---- */
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

.deduction-add-wrapper {
  position: relative;
}

.add-deduction-btn {
  font-size: 0.82rem;
  font-weight: 600;
  color: #444;
  background: #fff;
  border: 1px solid #ccc;
  border-radius: 6px;
  padding: 0.4rem 0.85rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
  white-space: nowrap;
}

.add-deduction-btn:hover {
  border-color: #111;
  color: #111;
}

.deduction-picker {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 50;
  width: 300px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 6px 24px rgba(0,0,0,0.09);
  overflow: hidden;
}

.picker-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  width: 100%;
  background: none;
  border: none;
  border-bottom: 1px solid #f0f0f0;
  padding: 0.75rem 1rem;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.picker-item:last-child {
  border-bottom: none;
}

.picker-item:hover {
  background: #f9f9f9;
}

.picker-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #222;
}

.picker-desc {
  font-size: 0.75rem;
  color: #888;
  margin-top: 0.15rem;
}

.no-deductions-msg {
  font-size: 0.85rem;
  color: #aaa;
  margin: 0.5rem 0 1rem;
}

.deduction-cards {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.deduction-card {
  border: 1px solid #e6e6e6;
  border-radius: 8px;
  background: #fefefe;
}

.deduction-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.9rem;
  background: #f7f7f7;
  border-bottom: 1px solid #eee;
  border-radius: 8px 8px 0 0;
}

.deduction-card-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: #222;
}

.remove-btn {
  background: none;
  border: none;
  color: #bbb;
  font-size: 0.8rem;
  cursor: pointer;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
  transition: color 0.2s, background 0.2s;
}

.remove-btn:hover {
  color: #e03131;
  background: #fff0f0;
}

.deduction-card-body {
  padding: 0.75rem 0.9rem;
}

.deduction-input-label {
  display: block;
  font-size: 0.8rem;
  color: #666;
  margin-bottom: 0.35rem;
}

.nhi-mode-toggle {
  display: flex;
  gap: 0;
  margin-top: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  overflow: hidden;
}

.nhi-mode-btn {
  flex: 1;
  padding: 0.35rem 0.5rem;
  font-size: 0.78rem;
  font-weight: 500;
  border: none;
  background: #fff;
  color: #666;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.nhi-mode-btn:first-child {
  border-right: 1px solid #ddd;
}

.nhi-mode-btn.active {
  background: #3b82f6;
  color: #fff;
}

.income-name-input {
  display: inline-block;
  width: 7rem;
  padding: 0.15rem 0.4rem;
  font-size: 0.82rem;
  border: 1px solid transparent;
  border-radius: 4px;
  color: #333;
  background: transparent;
  transition: border-color 0.2s, background 0.2s;
}

.income-name-input:hover {
  border-color: #ddd;
  background: #fafafa;
}

.income-name-input:focus {
  outline: none;
  border-color: #999;
  background: #fff;
}

.si-toggle-label {
  position: relative;
}

.tooltip-trigger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 0.3rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: #888;
  background: #eee;
  border-radius: 50%;
  cursor: help;
  vertical-align: middle;
  position: relative;
}

.tooltip-content {
  position: fixed;
  z-index: 10000;
  width: 320px;
  padding: 0.75rem 1rem;
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.5;
  color: #333;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
  white-space: normal;
  pointer-events: none;
}

.si-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #555;
  cursor: pointer;
}

.switch {
  position: relative;
  display: inline-block;
  width: 34px;
  height: 18px;
  flex-shrink: 0;
}

.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.switch-slider {
  position: absolute;
  inset: 0;
  background: #ccc;
  border-radius: 18px;
  transition: background 0.2s;
}

.switch-slider::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 14px;
  height: 14px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.switch input:checked + .switch-slider {
  background: #3b82f6;
}

.switch input:checked + .switch-slider::before {
  transform: translateX(16px);
}

.deduction-input {
  width: 100%;
  padding: 0.55rem 0.85rem;
  font-size: 0.95rem;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  color: #111;
  transition: border-color 0.2s;
}

.deduction-input:focus {
  outline: none;
  border-color: #111;
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

/* Home loan deduction card */
.deduction-card-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.edit-btn {
  background: none;
  border: 1px solid #ddd;
  color: #666;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
}

.edit-btn:hover {
  color: #111;
  border-color: #999;
  background: #f9f9f9;
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

.home-loan-summary {
  padding: 0.6rem 0.9rem !important;
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
</style>
