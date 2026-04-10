<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { calculateTaxesAndInsurance } from './utils/taxCalculation';
import { PREFECTURES_LIST, KYOKAI_KENPO_RATES, RESIDENT_TAX_RATES } from './data/taxRates';
import { translations } from './locales';
import {
  type DeductionEntry, type DeductionType,
  DEDUCTION_DEFS, DEDUCTION_ORDER, calculateDeductionAmount, getCashCost
} from './data/deductions';

const currentLocale = ref<'en' | 'ja'>('en');
const t = computed(() => translations[currentLocale.value]);

const monthlySalaryInput = ref<number | null>(300000);
const annualBonusInput = ref<number | null>(0);
const previousYearIncomeInput = ref<number | null>(null);

const employmentPrefecture = ref<string>("東京都 (Tokyo)");
const residencePrefecture = ref<string>("東京都 (Tokyo)");
const residenceCity = ref<string>("Standard / Other (その他市区町村)");

const handleResidencePrefectureChange = () => {
  residenceCity.value = "Standard / Other (その他市区町村)";
};

const availableCities = computed(() => {
  const pref = RESIDENT_TAX_RATES[residencePrefecture.value];
  if (!pref) return [];
  return Object.keys(pref.cities);
});

type KenpoType = 'kyokai' | 'its' | 'tjk' | 'other';
const selectedKenpo = ref<KenpoType>('kyokai');

type AgeGroupType = 'under40' | '40to64' | '65over';
const ageGroup = ref<AgeGroupType>('under40');

const showAdvancedOptions = ref<boolean>(false);

const customHealthRate = ref<number | null>(4.99);
const customKaigoRate = ref<number | null>(0);
const customPensionRate = ref<number | null>(9.15);

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

watch(employmentPrefecture, (newPref) => {
  if (selectedKenpo.value === 'kyokai') {
    customHealthRate.value = KYOKAI_KENPO_RATES[newPref] || 4.99;
  }
});

watch(ageGroup, () => {
  updateKaigoRate();
});

// --- Deductions ---
const deductionEntries = ref<DeductionEntry[]>([]);
const showDeductionPicker = ref(false);

const availableDeductionTypes = computed(() => {
  const used = new Set(deductionEntries.value.map(d => d.type));
  // Dependents can be added multiple times via count; others are singletons
  const singletons: DeductionType[] = ['life_insurance','earthquake_insurance','medical_expense','furusato','ideco','spouse'];
  return DEDUCTION_ORDER.filter(type => {
    if (singletons.includes(type)) return !used.has(type);
    return true; // counts — always available, user just bumps the number
  });
});

const totalAdditionalDeductions = computed(() => {
  const gross = (Number(monthlySalaryInput.value) || 0) * 12 + (Number(annualBonusInput.value) || 0);
  return deductionEntries.value
    .filter(e => !DEDUCTION_DEFS[e.type].isTaxCredit)  // tax-credit types are NOT income deductions
    .reduce((sum, entry) => sum + calculateDeductionAmount(entry.type, entry.value, gross), 0);
});

const furusatoNetDonation = computed(() => {
  const furusato = deductionEntries.value.find(e => e.type === 'furusato');
  if (!furusato || !furusato.value) return 0;
  return Math.max(0, furusato.value - 2000);
});

const addDeduction = (type: DeductionType) => {
  deductionEntries.value.push({
    id: `${type}-${Date.now()}`,
    type,
    value: DEDUCTION_DEFS[type].inputIsCount ? 1 : 0,
  });
  showDeductionPicker.value = false;
};

const removeDeduction = (id: string) => {
  deductionEntries.value = deductionEntries.value.filter(d => d.id !== id);
};

const deductionAmountFor = (entry: DeductionEntry) => {
  const gross = (Number(monthlySalaryInput.value) || 0) * 12 + (Number(annualBonusInput.value) || 0);
  return calculateDeductionAmount(entry.type, entry.value, gross);
};

const totalCashCost = computed(() =>
  deductionEntries.value.reduce((sum, e) => sum + getCashCost(e), 0)
);

const cashCostEntries = computed(() =>
  deductionEntries.value.filter(e => getCashCost(e) > 0)
);

const results = computed(() => {
  const salary = Number(monthlySalaryInput.value) || 0;
  const bonus = Number(annualBonusInput.value) || 0;
  const prevIncomeRaw = previousYearIncomeInput.value;
  const prevIncome = prevIncomeRaw === null ? null : Number(prevIncomeRaw);
  const hRate = customHealthRate.value !== null ? Number(customHealthRate.value) / 100 : 0.0499;
  const kRate = customKaigoRate.value !== null ? Number(customKaigoRate.value) / 100 : 0;
  const pRate = customPensionRate.value !== null ? Number(customPensionRate.value) / 100 : 0.0915;

  const prefData = RESIDENT_TAX_RATES[residencePrefecture.value];
  let localTaxRates = prefData ? prefData.default : { prefIncomeRate: 0.04, cityIncomeRate: 0.06, prefPerCapita: 1500, cityPerCapita: 3500 };
  
  if (prefData && residenceCity.value !== "Standard / Other (その他市区町村)") {
    const cityOverrides = prefData.cities[residenceCity.value];
    if (cityOverrides) {
      localTaxRates = cityOverrides;
    }
  }

  return calculateTaxesAndInsurance(salary, bonus, {
    previousYearGross: prevIncome,
    healthInsuranceRate: hRate,
    kaigoInsuranceRate: kRate,
    pensionRate: pRate,
    prefIncomeRate: localTaxRates.prefIncomeRate,
    cityIncomeRate: localTaxRates.cityIncomeRate,
    prefPerCapita: localTaxRates.prefPerCapita,
    cityPerCapita: localTaxRates.cityPerCapita,
    additionalDeductions: totalAdditionalDeductions.value,
    furusatoNetDonation: furusatoNetDonation.value,
  });
});

// Format JPY correctly
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);
};
</script>

<template>
  <div class="app-container">
    
    <button class="lang-toggle" @click="currentLocale = (currentLocale === 'en' ? 'ja' : 'en')">
      {{ currentLocale === 'en' ? '日本語' : 'English' }}
    </button>

    <!-- Input Panel -->
    <div class="panel input-panel">
      <header class="header">
        <h1>{{ t.title }}</h1>
        <p>{{ t.subtitle }}</p>
      </header>

      <div class="input-section location-section" style="margin-bottom: 2.5rem; padding-bottom: 1.5rem; border-bottom: 1px solid #eaeaea;">
        <h2>{{ t.locationSettings }}</h2>
        
        <div class="input-group">
          <label for="employmentPrefecture">{{ t.empPrefecture }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.empPrefectureSub }}</small></label>
          <div class="input-wrapper">
            <select id="employmentPrefecture" v-model="employmentPrefecture" class="styled-select">
              <option v-for="pref in PREFECTURES_LIST" :key="'emp-'+pref" :value="pref">{{ pref }}</option>
            </select>
          </div>
        </div>

        <div class="input-group">
          <label for="residencePrefecture">{{ t.resPrefecture }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.resPrefectureSub }}</small></label>
          <div class="input-wrapper">
            <select id="residencePrefecture" v-model="residencePrefecture" @change="handleResidencePrefectureChange" class="styled-select">
              <option v-for="pref in PREFECTURES_LIST" :key="'res-'+pref" :value="pref">{{ pref }}</option>
            </select>
          </div>
        </div>

        <div class="input-group" v-if="availableCities.length > 0">
          <label for="residenceCity">{{ t.municipality }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.municipalitySub }}</small></label>
          <div class="input-wrapper">
            <select id="residenceCity" v-model="residenceCity" class="styled-select">
              <option value="Standard / Other (その他市区町村)">{{ t.standardCity }}</option>
              <option v-for="city in availableCities" :key="city" :value="city">{{ city }}</option>
            </select>
          </div>
        </div>
      </div>

      <div class="input-section">
        <h2>{{ t.incomeDetails }}</h2>
        
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

        <div class="input-group">
          <label for="monthlySalary">{{ t.monthlySalary }}</label>
          <div class="input-wrapper has-currency">
            <span class="currency-symbol">¥</span>
            <input 
              id="monthlySalary"
              type="number" 
              v-model.number="monthlySalaryInput" 
              min="0"
              step="1000"
              placeholder="e.g. 300000"
            />
          </div>
        </div>

        <div class="input-group">
          <label for="annualBonus">{{ t.annualBonus }}</label>
          <div class="input-wrapper has-currency">
            <span class="currency-symbol">¥</span>
            <input 
              id="annualBonus"
              type="number" 
              v-model.number="annualBonusInput" 
              min="0"
              step="1000"
              placeholder="e.g. 1000000"
            />
          </div>
        </div>

        <div class="input-group">
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
              <input 
                id="customHealthRate"
                type="number" 
                v-model.number="customHealthRate" 
                min="0"
                step="0.01"
              />
              <span class="percentage-symbol">%</span>
            </div>
          </div>

          <div class="input-group">
            <label for="customKaigoRate">{{ t.customKaigo }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.customKaigoSub }}</small></label>
            <div class="input-wrapper has-percentage">
              <input 
                id="customKaigoRate"
                type="number" 
                v-model.number="customKaigoRate" 
                min="0"
                step="0.01"
              />
              <span class="percentage-symbol">%</span>
            </div>
          </div>

          <div class="input-group">
            <label for="customPensionRate">{{ t.customPension }} <br/><small style="font-weight: normal; font-size: 0.85em; color: #777;">{{ t.customPensionSub }}</small></label>
            <div class="input-wrapper has-percentage">
              <input 
                id="customPensionRate"
                type="number" 
                v-model.number="customPensionRate" 
                min="0"
                step="0.01"
              />
              <span class="percentage-symbol">%</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Deductions Section -->
      <div class="input-section deductions-section">
        <div class="deductions-header">
          <h2>{{ t.deductionsSection }}</h2>
          <div class="deduction-add-wrapper">
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
              <button class="remove-btn" @click="removeDeduction(entry.id)" :title="t.removeDeduction">✕</button>
            </div>
            <div class="deduction-card-body">
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

        <div class="divider"></div>

        <div class="result-row deduction social-insurance-row">
          <span>{{ t.healthIns }} <small class="bracket-info">{{ t.gradeString }} {{ results.healthBracket }}</small></span>
          <span class="social-ins-value">- {{ formatCurrency(results.healthInsurance) }}</span>
        </div>

        <div class="result-row deduction social-insurance-row" v-if="results.kaigoInsurance > 0">
          <span>{{ t.nursingCare }}</span>
          <span class="social-ins-value">- {{ formatCurrency(results.kaigoInsurance) }}</span>
        </div>
        
        <div class="result-row deduction social-insurance-row">
          <span>{{ t.pension }} <small class="bracket-info">{{ t.gradeString }} {{ results.pensionBracket }}</small></span>
          <span class="social-ins-value">- {{ formatCurrency(results.pension) }}</span>
        </div>
        <div class="result-row deduction">
          <span>{{ t.basicExemption }}</span>
          <span>- {{ formatCurrency(results.basicExemption) }}</span>
        </div>

        <template v-if="deductionEntries.length > 0">
          <div
            class="result-row deduction user-deduction-row"
            v-for="entry in deductionEntries"
            :key="entry.id"
          >
            <span>
              {{ currentLocale === 'ja' ? DEDUCTION_DEFS[entry.type].nameJa : DEDUCTION_DEFS[entry.type].nameEn }}
            </span>
            <span>- {{ formatCurrency(deductionAmountFor(entry)) }}</span>
          </div>
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

        <div class="result-row deduction">
          <span>{{ t.residentTax }}</span>
          <span>- {{ formatCurrency(results.residentTax) }}</span>
        </div>
        <div class="result-row deduction sub-item furusato-credit-row" v-if="results.furusatoResidentTaxCredit > 0">
          <span>✓ {{ t.furusatoResidentTaxCredit }}</span>
          <span class="furusato-credit-value">+ {{ formatCurrency(results.furusatoResidentTaxCredit) }}</span>
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
  </div>
</template>

<style scoped>
/* Language toggle */
.lang-toggle {
  position: fixed;
  top: 1.25rem;
  right: 1.5rem;
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

.lang-toggle:hover {
  color: #111;
  border-color: #111;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

/* Minimalist, clean styling */
.app-container {
  min-height: 100vh;
  width: 100%;
  display: flex;
  justify-content: flex-start;
  align-items: stretch;
  background-color: #fafafa;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  color: #111;
  box-sizing: border-box;
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

.header {
  text-align: left;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid #eaeaea;
}

.header h1 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #111;
}

.header p {
  font-size: 1rem;
  color: #666;
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
  overflow: hidden;
  background: #fefefe;
}

.deduction-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.9rem;
  background: #f7f7f7;
  border-bottom: 1px solid #eee;
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
